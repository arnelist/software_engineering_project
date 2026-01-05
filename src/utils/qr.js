export function buildCheckinQrValue(reservationId) {
    return `coachbooking:checkin?reservationId=${encodeURIComponent(reservationId)}`
}

export function parseCheckinQrValue(raw) {
    if (!raw || typeof raw !== "string") return null;

    const prefix = "coachbooking:checkin?";
    if (!raw.startsWith(prefix)) return null;

    const queryString = raw.slice(prefix.length);
    const params = new URLSearchParams(queryString);
    const reservationId = params.get("reservationId");

    if (!reservationId) return null;
    return { reservationId };
}