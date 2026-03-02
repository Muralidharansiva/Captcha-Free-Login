# api/utils.py
import random
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

BERTH_LABEL_TO_CODES = {
    "Lower": {"LB"},
    "Middle": {"MB"},
    "Upper": {"UB"},
    "Side Lower": {"SL"},
    "Side Upper": {"SU"},
    "No Preference": {"LB", "MB", "UB", "SL", "SU"},
}

BERTH_CODE_TO_LABEL = {
    "LB": "Lower Berth",
    "MB": "Middle Berth",
    "UB": "Upper Berth",
    "SL": "Side Lower",
    "SU": "Side Upper",
}


def _coach_layout():
    # Standard 72-seat sleeper-like berth cycle.
    cycle = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"]
    layout = []
    seat = 1
    for _ in range(9):
        for berth_code in cycle:
            layout.append((seat, berth_code))
            seat += 1
    return layout


def _normalized_gender(value):
    v = str(value or "").strip().lower()
    if v in {"male", "m"}:
        return "Male"
    if v in {"female", "f"}:
        return "Female"
    return "Other"


def validate_passenger_mix(passengers, is_family):
    genders = {_normalized_gender(p.get("gender")) for p in (passengers or []) if isinstance(p, dict)}
    if len(genders) > 1 and not is_family:
        return False, "Mixed-gender booking is allowed only for family bookings."
    return True, ""


def generate_seat_details(passengers, is_family: bool = False):
    coaches = ["S1", "S2", "S3", "A1", "A2", "B1"]
    coach_layout = _coach_layout()
    used_seats = defaultdict(set)
    allocations = []

    for idx, passenger in enumerate(passengers or []):
        pref = str(passenger.get("berth", "No Preference"))
        allowed = BERTH_LABEL_TO_CODES.get(pref, BERTH_LABEL_TO_CODES["No Preference"])
        assigned = None

        # Keep family passengers in same coach when possible.
        coach_order = coaches[:]
        if is_family and allocations:
            primary = allocations[0]["coach"]
            coach_order = [primary] + [c for c in coaches if c != primary]

        for coach in coach_order:
            for seat_number, berth_code in coach_layout:
                if berth_code not in allowed:
                    continue
                if seat_number in used_seats[coach]:
                    continue
                used_seats[coach].add(seat_number)
                assigned = {
                    "coach": coach,
                    "seatNumber": str(seat_number),
                    "berth": BERTH_CODE_TO_LABEL[berth_code],
                    "status": "CONFIRMED",
                }
                break
            if assigned:
                break

        # Fallback if preference could not be satisfied.
        if not assigned:
            coach = random.choice(coaches)
            remaining = [s for s, _ in coach_layout if s not in used_seats[coach]]
            seat_number = random.choice(remaining) if remaining else random.randint(1, 72)
            berth_code = next((b for s, b in coach_layout if s == seat_number), "LB")
            used_seats[coach].add(seat_number)
            assigned = {
                "coach": coach,
                "seatNumber": str(seat_number),
                "berth": BERTH_CODE_TO_LABEL.get(berth_code, "Lower Berth"),
                "status": "CONFIRMED",
            }

        allocations.append(assigned)

    return allocations

def generate_pnr():
    # 10-digit numeric PNR (string)
    return str(random.randint(1000000000, 9999999999))
