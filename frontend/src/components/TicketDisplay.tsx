import { Booking } from '@/types/booking';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Train, Calendar, Clock, MapPin, User, Ticket, IndianRupee } from 'lucide-react';

interface TicketDisplayProps {
  booking: Booking;
}

export const TicketDisplay = ({ booking }: TicketDisplayProps) => {
  const passengers = Array.isArray(booking.passengers) ? booking.passengers : [];
  const seatDetails = Array.isArray(booking.seatDetails) ? booking.seatDetails : [];
  const platformNumber = (booking.train as any)?.platformNumber ?? 'Not assigned';

  return (
    <Card className="mx-auto max-w-3xl overflow-hidden rounded-2xl border-0 bg-white shadow-xl">
      <div className="bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5] p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">Ticket Confirmed</h2>
              <p className="text-white/85">PNR: {booking.pnr}</p>
            </div>
          </div>
          <div className={`rounded-full px-4 py-2 text-sm font-semibold ${
            booking.status === 'CONFIRMED'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {booking.status}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3 border-b border-[#e6edf7] pb-4">
          <Train className="h-6 w-6 text-[#1f78de]" />
          <div>
            <h3 className="text-xl font-bold text-[#113454]">
              {booking.train.trainName} ({booking.train.trainNumber})
            </h3>
            <p className="text-sm text-[#617286]">Transaction ID: {booking.transactionId}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl bg-[#f5f9ff] p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 text-[#1f78de]" />
              <div>
                <p className="text-sm text-[#617286]">From to To</p>
                <p className="text-lg font-semibold text-[#113454]">
                  {booking.train.source} to {booking.train.destination}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-1 h-5 w-5 text-[#1f78de]" />
              <div>
                <p className="text-sm text-[#617286]">Journey Date</p>
                <p className="font-semibold text-[#113454]">{booking.journeyDate}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Train className="mt-1 h-5 w-5 text-[#1f78de]" />
              <div>
                <p className="text-sm text-[#617286]">Platform Number</p>
                <p className="font-semibold text-[#113454]">{platformNumber}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl bg-[#f5f9ff] p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-1 h-5 w-5 text-[#1f78de]" />
              <div>
                <p className="text-sm text-[#617286]">Departure</p>
                <p className="font-semibold text-[#113454]">{booking.train.departureTime}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-1 h-5 w-5 text-[#1f78de]" />
              <div>
                <p className="text-sm text-[#617286]">Arrival</p>
                <p className="font-semibold text-[#113454]">{booking.train.arrivalTime}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e6edf7] pt-6">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-[#1f78de]" />
            <h4 className="text-lg font-semibold text-[#113454]">Passenger Details</h4>
          </div>

          <div className="space-y-3">
            {passengers.map((passenger: any, index: number) => {
              const seat = seatDetails[index] || {
                coach: passenger.coach,
                seatNumber: passenger.seatNumber,
                berth: passenger.berth,
                status: passenger.status,
              };
              return (
                <div
                  key={index}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-[#e2ebf6] bg-[#f9fbff] p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1f78de] font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-[#113454]">{passenger.name}</p>
                      <p className="text-sm text-[#617286]">
                        {passenger.age} years | {passenger.gender}
                      </p>
                    </div>
                  </div>

                  {seat && (
                    <div className="flex items-center gap-4 sm:pl-4">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-[#1f78de]" />
                        <div className="text-sm">
                          <p className="font-semibold text-[#113454]">
                            Coach {seat.coach} | Seat {seat.seatNumber}
                          </p>
                          <p className="text-[#617286]">{seat.berth}</p>
                        </div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        seat.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {seat.status}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#e6edf7] pt-6">
          <div className="flex items-center justify-between text-lg">
            <span className="font-semibold text-[#244761]">Total Fare</span>
            <span className="flex items-center text-2xl font-bold text-[#1f78de]">
              <IndianRupee className="h-5 w-5" />
              {booking.totalFare}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
