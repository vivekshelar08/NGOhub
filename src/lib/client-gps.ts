/** Capture GPS for punch / field work — client only. */
export function captureClientGps(): Promise<{ latitude?: number; longitude?: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve({}),
      { timeout: 8000, maximumAge: 60_000 }
    );
  });
}
