"""Nortex Travel & Expense Policy NTX-HR-POL-11 Rev 4 — limits used in code (docs/expense_policy.md)."""

from decimal import Decimal

from database.postgres.models.enums import TravelCategory

# Advance may cover at most this share of the total estimated cost
MAX_ADVANCE_RATIO = Decimal("0.60")

# §3.1 Lodging per night (room tariff excluding taxes)
LODGING_LIMIT_PER_NIGHT = {
    TravelCategory.DOMESTIC_TIER_1: Decimal("6000"),
    TravelCategory.DOMESTIC_TIER_2: Decimal("4000"),
    TravelCategory.DOMESTIC_TIER_3: Decimal("2800"),
    TravelCategory.INTERNATIONAL: Decimal("6000"),
}

# §3.1 Tier 1 cities (lodging limit follows the hotel's city when known)
TIER_1_CITIES = {
    "bengaluru": "Bengaluru",
    "bangalore": "Bengaluru",
    "mumbai": "Mumbai",
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "gurugram": "Gurugram",
    "gurgaon": "Gurugram",
    "noida": "Noida",
    "hyderabad": "Hyderabad",
    "chennai": "Chennai",
    "pune": "Pune",
    "kolkata": "Kolkata",
}

# §3.3 Meals per full day; bills needed above this amount
MEAL_LIMIT_TIER_1 = Decimal("1500")
MEAL_LIMIT_OTHER = Decimal("1000")
MEAL_BILL_REQUIRED_ABOVE = Decimal("500")

# §3.5 Business entertainment needs HoD prior approval above this
ENTERTAINMENT_PRE_APPROVAL_ABOVE = Decimal("2000")

# §5.1 Submit the claim within this many days of return
SUBMISSION_WINDOW_DAYS = 7

# §4 Never reimbursed (keyword -> label shown to the employee)
NON_REIMBURSABLE_KEYWORDS = {
    "laundry": "Laundry",
    "mini bar": "Mini bar",
    "minibar": "Mini bar",
    "spa": "Spa",
    "gym": "Gym",
    "in-room movie": "In-room entertainment",
    "movie": "In-room entertainment",
    "beer": "Alcohol",
    "wine": "Alcohol",
    "whisky": "Alcohol",
    "whiskey": "Alcohol",
    "vodka": "Alcohol",
    "rum": "Alcohol",
    "liquor": "Alcohol",
    "challan": "Fine / challan",
    "penalty": "Fine / penalty",
    "insurance": "Travel insurance",
}


def meal_limit(category: TravelCategory) -> Decimal:
    tier_1 = category in {TravelCategory.DOMESTIC_TIER_1, TravelCategory.INTERNATIONAL}
    return MEAL_LIMIT_TIER_1 if tier_1 else MEAL_LIMIT_OTHER
