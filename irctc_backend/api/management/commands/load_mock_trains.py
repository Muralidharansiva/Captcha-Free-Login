from django.core.management.base import BaseCommand
from api.models import SelectedTrain, TrainAvailability
from api.fixtures.mock_trains import MOCK_TRAINS
from datetime import datetime

class Command(BaseCommand):
    help = "Load mock trains into SelectedTrain and TrainAvailability"

    def handle(self, *args, **kwargs):
        user_id = "murali05196570"
        count = 0

        for train in MOCK_TRAINS:
            SelectedTrain.objects.update_or_create(
                user_id=user_id,
                train=train
            )

            TrainAvailability.objects.update_or_create(
                train_number=train["trainNumber"],
                journey_date=datetime.strptime(train["date"], "%Y-%m-%d").date(),
                class_type="SL",
                quota="GN",
                defaults={"available_seats": train["availableSeats"]}
            )

            count += 1

        self.stdout.write(self.style.SUCCESS(f"✅ Loaded {count} trains for user {user_id}"))
