# ADR 0001: Floors Are Orthogonal to Neighborhoods

## Status

Accepted

## Context

Needle needs ordered floors, per-floor editing, cross-floor relations, and an exploded building view. Neighborhoods already represent semantic groupings and can legitimately contain concepts that live on different floors.

## Decision

Persist floors as an ordered collection on the ontology document. Every concept references exactly one floor. Neighborhoods remain global semantic groupings, while each floor owns the positions of the neighborhood flags rendered on it. The active floor and building-view mode remain local editor state.

## Consequences

Floor filtering and building projections must be derived centrally. Cross-floor relations are inferred from their endpoint concepts. Collaborators can navigate independently while edits to floors and concepts continue to synchronize through the shared document.
