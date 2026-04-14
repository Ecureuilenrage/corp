import type { Mission } from "../../../contracts/src/mission/mission";

export interface MissionStatusProjection {
  schemaVersion: 1;
  mission: Mission | null;
}

export function createMissionStatusProjection(
  mission: Mission,
): MissionStatusProjection {
  return {
    schemaVersion: 1,
    mission,
  };
}
