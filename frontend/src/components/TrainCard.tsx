import { Train } from '@/types/booking';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, IndianRupee, Users } from 'lucide-react';

interface TrainCardProps {
  train: Train;
  onBook: (train: Train) => void;
}

export const TrainCard = ({ train, onBook }: TrainCardProps) => {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-white p-5 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-[#1f78de] px-4 py-1.5 text-sm font-bold text-white">
              {train.trainNumber}
            </div>
            <h3 className="text-xl font-semibold text-[#113454]">{train.trainName}</h3>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-5 text-sm text-[#617286]">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{train.source} to {train.destination}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{train.duration || 'Duration not available'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#f3f8ff] p-4">
            <div>
              <p className="text-xs text-[#72859a]">Departure</p>
              <p className="text-lg font-semibold text-[#113454]">{train.departureTime}</p>
              <p className="text-xs text-[#617286]">{train.source}</p>
            </div>
            <div>
              <p className="text-xs text-[#72859a]">Arrival</p>
              <p className="text-lg font-semibold text-[#113454]">{train.arrivalTime}</p>
              <p className="text-xs text-[#617286]">{train.destination}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 md:min-w-[210px] md:items-end">
          <div className="text-left md:text-right">
            <div className="flex items-center gap-1 text-3xl font-bold text-[#1f78de]">
              <IndianRupee className="h-6 w-6" />
              {train.fare}
            </div>
            <p className="text-xs text-[#72859a]">per passenger</p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-700">{train.availableSeats} seats available</span>
          </div>

          <Button
            onClick={() => onBook(train)}
            className="h-11 w-full rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]"
            size="lg"
          >
            Book Now
          </Button>
        </div>
      </div>
    </Card>
  );
};

