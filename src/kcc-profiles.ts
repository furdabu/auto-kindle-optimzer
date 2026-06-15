/** KCC v9.7.2 の ProfileData 解像度（幅, 高さ） */
const PROFILE_RESOLUTIONS: Record<string, readonly [number, number]> = {
  K1: [600, 670],
  K2: [600, 670],
  K3: [600, 800],
  K4: [600, 800],
  K5: [1072, 1448],
  KDX: [1200, 1600],
  KPW: [758, 1024],
  KPW2: [758, 1024],
  KPW3: [1072, 1448],
  KPW4: [1072, 1448],
  KPW5: [1072, 1448],
  KPW6: [1272, 1696],
  KV: [1072, 1448],
  KV2: [1072, 1448],
  K11: [1620, 2160],
  KS1860: [1860, 1920],
  KS1920: [1920, 1920],
  KoMT: [600, 800],
  KoG: [768, 1024],
  KoGHD: [1080, 1440],
  KoA: [1080, 1440],
  KoAH: [1080, 1440],
  KoAHD: [1440, 1920],
  KoN: [1080, 1440],
  KoC: [1080, 1440],
  KoL: [1264, 1680],
  KoF: [1440, 1920],
  KoS: [1440, 1920],
  KoT: [1440, 1920],
  KoU: [1440, 1920],
  Rmk1: [1404, 1872],
  Rmk2: [1404, 1872],
  RmkPP: [1620, 2160],
  RmkPP2: [1620, 2160],
};

export function getProfileResolution(profile: string): [number, number] | null {
  const resolution = PROFILE_RESOLUTIONS[profile.toUpperCase()];
  return resolution ? [resolution[0], resolution[1]] : null;
}
