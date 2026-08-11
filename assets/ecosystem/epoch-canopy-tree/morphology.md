# Epoch canopy tree morphology

## Ecological job

Provides persistent woody cover, makes succession visible, protects established soil from erosion, and visually indicates where forage-producing vegetation can recover.

## Real-world referents

Broadleaf trees borrow the spreading scaffold and clustered canopy of temperate oaks. Conifers borrow a narrower, tiered spruce silhouette. Windswept trees borrow krummholz flagging: a compact trunk and branches displaced with the prevailing wind. Mangroves borrow the radial prop-root silhouette of red mangroves and occur only in warm saltwater intertidal habitat.

## Silhouette bet

At gameplay distance the player should read forest, cold high ground, and exposed ridge as different growth pressures. Up close, every tree should visibly connect trunk to branch to crown instead of reading as foliage placed on a pole.

## Trait map

| Trait | Environmental driver | Continuous or discrete | Visible expression |
|---|---|---|---|
| Height | Succession, temperature, elevation | Continuous | Whole skeleton scales taller in mature productive habitat |
| Crown width and depth | Moisture and shelter | Continuous | Productive sheltered trees spread outward |
| Trunk width | Exposure and final size | Continuous | Larger and more exposed trees carry heavier bases |
| Lean | Prevailing wind | Continuous | Skeleton and crown shift downwind |
| Foliage palette | Moisture, temperature, local variation | Continuous | Habitat-resolved HSL remains authoritative |
| Growth guild | Temperature, elevation, slope, exposure, salinity, inundation | Discrete | Broadleaf, conifer, windswept, and mangrove skeleton grammars |

## Family resemblance

All guilds share seeded ez-tree skeleton generation, Epoch-owned faceted foliage, a brown bark family, shared-skeleton two-level LODs, and the habitat-authored palette contract. Mangrove prop roots extend the common woody grammar rather than creating a separate decorative species.

## Rejected directions

- Unique high-detail geometry per occupant was rejected because it would destroy the cached instancing budget.
- Spherical crowns without visible branches were rejected because they preserve the close-up lollipop failure.
- Decorative fantasy colors were rejected because foliage color must remain evidence of habitat pressure.

## Candidate visual note

The ez-tree skeleton substantially improves branch continuity and variation. Epoch replaces its untextured billboard leaves with faceted clusters generated from the same leaf anchors, keeps all runtime materials under WebGPU ownership, and loads packed geometry as a separate cacheable asset. Strongly backlit foreground trees can still lose interior form; acceptance should wait for the owner's visual verdict.
