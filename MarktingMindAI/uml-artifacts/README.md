# UML Artifacts

This folder contains PlantUML artifacts for the current frontend and backend implementation.

## Diagram Inventory

- `frontend-component.puml` - Frontend component architecture
- `frontend-sequence.puml` - Frontend-to-backend runtime sequence
- `backend-component.puml` - Backend layered component architecture
- `backend-sequence.puml` - Backend request processing sequences
- `system-deployment.puml` - End-to-end deployment/runtime topology

## Suggested Render Commands

If PlantUML is installed:

```bash
cd uml-artifacts
plantuml *.puml
```

This generates PNG/SVG artifacts alongside the `.puml` sources.

## Scope Notes

- Diagrams reflect routes, services, and data flow currently implemented in code.
- Test data persistence is modeled using `test_data.json` and `test_data.default.json`.
- PostgreSQL is shown as optional because the system can run on JSON seed data.
