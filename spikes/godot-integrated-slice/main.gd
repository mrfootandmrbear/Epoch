extends Node3D

const FIXTURE := "res://fixture/landing-state.json"
var fixture: Dictionary
var camera: Camera3D
var water_material: ShaderMaterial
var paused := false

func _ready() -> void:
	fixture = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE))
	assert(fixture.get("schemaVersion") == 1)
	assert(is_equal_approx(float(fixture.get("metresPerUnit")), 1.0))
	build_environment()
	build_terrain()
	build_water()
	build_habitat()
	build_animals()
	build_camera()
	build_overlay()
	apply_camera("wholeIsland")
	var capture := read_capture_argument()
	if not capture.is_empty():
		apply_camera(capture)
		capture_frame.call_deferred(capture)

func read_capture_argument() -> String:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--capture="):
			var requested := argument.trim_prefix("--capture=")
			if requested in ["wholeIsland", "shoreline"]: return requested
	return ""

func capture_frame(which: String) -> void:
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var output := "res://captures/%s.png" % which
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://captures"))
	var error := get_viewport().get_texture().get_image().save_png(output)
	print("CAPTURE ", output, " ", error_string(error))
	get_tree().quit(0 if error == OK else 1)

func build_environment() -> void:
	var world := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#496f88")
	sky_material.sky_horizon_color = Color("#b6c7c5")
	sky_material.ground_bottom_color = Color("#182a27")
	sky_material.ground_horizon_color = Color("#9aaea7")
	sky_material.sun_angle_max = 12.0
	sky.sky_material = sky_material
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.62
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.fog_enabled = true
	env.fog_light_color = Color("#aebfbd")
	env.fog_light_energy = 0.75
	env.fog_density = 0.00045
	env.fog_height = 2.0
	env.fog_height_density = 0.025
	world.environment = env
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -38, 0)
	sun.light_color = Color("#ffe8c7")
	sun.light_energy = 1.85
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 520
	add_child(sun)

func build_terrain() -> void:
	var terrain: Dictionary = fixture.terrain
	var side := int(terrain.side)
	var extent := float(terrain.extent)
	var step := extent / float(side - 1)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for z in range(side - 1):
		for x in range(side - 1):
			var a := terrain_point(x, z, side, step, extent)
			var b := terrain_point(x + 1, z, side, step, extent)
			var c := terrain_point(x + 1, z + 1, side, step, extent)
			var d := terrain_point(x, z + 1, side, step, extent)
			for p in [a, c, b, a, d, c]:
				st.set_color(terrain_color(p.y, p.x, p.z))
				st.add_vertex(p)
	st.generate_normals()
	var mesh := MeshInstance3D.new()
	mesh.name = "EpochTerrain"
	mesh.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.91
	mesh.material_override = mat
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(mesh)

func terrain_point(x: int, z: int, side: int, step: float, extent: float) -> Vector3:
	return Vector3(x * step - extent * 0.5, float(fixture.terrain.heights[z * side + x]), z * step - extent * 0.5)

func terrain_color(y: float, x: float, z: float) -> Color:
	var variation := sin(x * 0.075) * cos(z * 0.061) * 0.045
	if y < 0.8: return Color(0.42 + variation, 0.32 + variation, 0.18 + variation)
	if y < 4.0: return Color(0.34 + variation, 0.45 + variation, 0.20 + variation)
	if y > 27.0: return Color(0.36 + variation, 0.39 + variation, 0.27 + variation)
	return Color(0.25 + variation, 0.46 + variation, 0.20 + variation)

func build_water() -> void:
	var far_water := MeshInstance3D.new()
	var far_plane := PlaneMesh.new()
	far_plane.size = Vector2(6000, 6000)
	far_water.mesh = far_plane
	far_water.position.y = -0.18
	var far_material := StandardMaterial3D.new()
	far_material.albedo_color = Color("#123f4b")
	far_material.roughness = .18
	far_material.metallic = .08
	far_water.material_override = far_material
	add_child(far_water)

	var water := MeshInstance3D.new()
	var terrain: Dictionary = fixture.terrain
	var side := int(terrain.side)
	var extent := float(terrain.extent)
	var step := extent / float(side - 1)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for z in range(side - 1):
		for x in range(side - 1):
			var i := z * side + x
			var a := Vector3(x * step - extent * .5, 0, z * step - extent * .5)
			var b := Vector3((x + 1) * step - extent * .5, 0, z * step - extent * .5)
			var c := Vector3((x + 1) * step - extent * .5, 0, (z + 1) * step - extent * .5)
			var d := Vector3(x * step - extent * .5, 0, (z + 1) * step - extent * .5)
			var ha := float(terrain.heights[i])
			var hb := float(terrain.heights[i + 1])
			var hc := float(terrain.heights[i + side + 1])
			var hd := float(terrain.heights[i + side])
			if maxf(ha, maxf(hc, hb)) < 0.8:
				for p in [a, c, b]: st.add_vertex(p)
			if maxf(ha, maxf(hd, hc)) < 0.8:
				for p in [a, d, c]: st.add_vertex(p)
	water.mesh = st.commit()
	water.position.y = 0.12
	water_material = ShaderMaterial.new()
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_back, diffuse_burley, specular_schlick_ggx;
uniform float time_scale = 1.0;
varying float wave;
void vertex() {
 vec2 p = VERTEX.xz;
 float t = TIME * time_scale;
 wave = sin(p.x*.055+t*.72)*.18 + sin(p.y*.081-t*.53)*.11 + sin((p.x+p.y)*.027+t*.31)*.22;
 VERTEX.y += wave;
}
void fragment() {
 vec3 n = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
 float fresnel = pow(1.0 - clamp(dot(n, VIEW), 0.0, 1.0), 5.0);
 float depth_hint = smoothstep(95.0, 220.0, length(VERTEX.xz));
 vec3 shallow = vec3(.025,.24,.25);
 vec3 deep = vec3(.012,.065,.09);
 ALBEDO = mix(shallow, deep, depth_hint) + fresnel * vec3(.18,.25,.27);
 ROUGHNESS = mix(.16, .06, fresnel);
 METALLIC = .04;
 ALPHA = mix(.72, .94, fresnel);
}
"""
	water_material.shader = shader
	water.material_override = water_material
	add_child(water)

func build_habitat() -> void:
	for item in fixture.trees:
		var tree := Node3D.new()
		tree.position = Vector3(item[0], item[1], item[2])
		tree.rotation.y = item[4]
		tree.scale = Vector3.ONE * item[3]
		var trunk := MeshInstance3D.new()
		var trunk_mesh := CylinderMesh.new()
		trunk_mesh.top_radius = .22
		trunk_mesh.bottom_radius = .48
		trunk_mesh.height = 5.8
		trunk_mesh.radial_segments = 7
		trunk.mesh = trunk_mesh
		trunk.position.y = 2.9
		trunk.material_override = material(Color("#443b2d"), .95)
		tree.add_child(trunk)
		for offset in [Vector3(0, 6.8, 0), Vector3(1.1, 6.0, .3), Vector3(-.8, 6.2, -.5)]:
			var crown := MeshInstance3D.new()
			var crown_mesh := SphereMesh.new()
			crown_mesh.radius = 2.3
			crown_mesh.height = 4.8
			crown_mesh.radial_segments = 7
			crown_mesh.rings = 4
			crown.mesh = crown_mesh
			crown.position = offset
			crown.scale = Vector3(.82, 1.25, .82)
			crown.material_override = material(Color("#183d28").lerp(Color("#557344"), fposmod(item[4], 1.0) * .25), .88)
			tree.add_child(crown)
		add_child(tree)
	for item in fixture.understory:
		var tuft := MeshInstance3D.new()
		var tuft_mesh := SphereMesh.new()
		tuft_mesh.radius = .65
		tuft_mesh.height = 1.1
		tuft_mesh.radial_segments = 6
		tuft_mesh.rings = 3
		tuft.mesh = tuft_mesh
		tuft.position = Vector3(item[0], item[1] + .45, item[2])
		tuft.scale = Vector3(item[3], .6, item[3])
		tuft.material_override = material(Color("#385c32"), .98)
		add_child(tuft)

func build_animals() -> void:
	for item in fixture.animals:
		var animal := Node3D.new()
		animal.position = Vector3(item[0], item[1] + .8, item[2])
		animal.rotation.y = item[4]
		animal.scale = Vector3.ONE * item[3]
		var body := MeshInstance3D.new()
		var body_mesh := SphereMesh.new()
		body_mesh.radius = .65
		body_mesh.height = 1.4
		body_mesh.radial_segments = 8
		body_mesh.rings = 5
		body.mesh = body_mesh
		body.scale = Vector3(1.55, .82, .72)
		body.material_override = material(Color("#9d7256"), .86)
		animal.add_child(body)
		var head := MeshInstance3D.new()
		head.mesh = body_mesh
		head.scale = Vector3(.48, .5, .45)
		head.position = Vector3(1.0, .28, 0)
		head.material_override = body.material_override
		animal.add_child(head)
		add_child(animal)

func material(color: Color, roughness: float) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = roughness
	return result

func build_camera() -> void:
	camera = Camera3D.new()
	camera.current = true
	camera.near = .1
	camera.far = 8000
	add_child(camera)

func apply_camera(which: String) -> void:
	var shot: Dictionary = fixture.cameras[which]
	camera.position = Vector3(shot.position[0], shot.position[1], shot.position[2])
	camera.fov = shot.fov
	camera.look_at(Vector3(shot.target[0], shot.target[1], shot.target[2]))

func build_overlay() -> void:
	var label := Label.new()
	label.text = "GODOT INTEGRATED SLICE  •  1 WHOLE ISLAND  •  2 SHORELINE  •  SPACE FREEZE WATER"
	label.position = Vector2(18, 16)
	label.add_theme_color_override("font_color", Color("#e8f1e8"))
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, .8))
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 2)
	add_child(label)

func _unhandled_key_input(event: InputEvent) -> void:
	if not event.pressed: return
	if event.keycode == KEY_1: apply_camera("wholeIsland")
	elif event.keycode == KEY_2: apply_camera("shoreline")
	elif event.keycode == KEY_SPACE:
		paused = not paused
		water_material.set_shader_parameter("time_scale", 0.0 if paused else 1.0)
