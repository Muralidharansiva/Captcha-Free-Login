import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Train, Passenger } from '@/types/booking';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ArrowLeft, IndianRupee } from 'lucide-react';
import { api } from '@/utils/api';
import { getCurrentUser, isAuthenticated } from '@/utils/auth';

const Booking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [train, setTrain] = useState<Train | null>(null);
  const [loadingTrain, setLoadingTrain] = useState(true);
  const [passengers, setPassengers] = useState<Passenger[]>([
    { name: '', age: 0, gender: 'Male', berth: 'No Preference' }
  ]);
  const [isFamilyBooking, setIsFamilyBooking] = useState(false);

  useEffect(() => {
    const loadSelectedTrain = async () => {
      if (!isAuthenticated()) {
        navigate('/auth');
        return;
      }

      const user = getCurrentUser();
      const identity = user?.username || user?.email;
      if (!identity) {
        navigate('/auth');
        return;
      }

      try {
        const data = await api(
          `select-train/?email=${encodeURIComponent(identity)}`,
          'GET',
          undefined,
          true
        );

        if (!data.train) {
          navigate('/search');
          return;
        }

        setTrain(data.train);
      } catch (err: any) {
        toast({
          title: 'Unable to load booking',
          description: err?.message || 'Please choose train again.',
          variant: 'destructive',
        });
        navigate('/search');
      } finally {
        setLoadingTrain(false);
      }
    };

    loadSelectedTrain();
  }, [navigate, toast]);

  const addPassenger = () => {
    if (passengers.length < 6) {
      setPassengers([
        ...passengers,
        { name: '', age: 0, gender: 'Male', berth: 'No Preference' }
      ]);
    }
  };

  const removePassenger = (index: number) => {
    if (passengers.length > 1) {
      setPassengers(passengers.filter((_, i) => i !== index));
    }
  };

  const updatePassenger = (index: number, field: keyof Passenger, value: any) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const handleProceedToPayment = async () => {
    const user = getCurrentUser();
    const identity = user?.username || user?.email;
    if (!identity) {
      navigate('/auth');
      return;
    }

    for (const p of passengers) {
      if (!p.name || p.age <= 0 || p.age > 120) {
        toast({
          title: 'Invalid Data',
          description: 'Please fill all passenger details correctly',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      await api('save-passengers/', 'POST', {
        email: identity,
        passengers,
        isFamily: isFamilyBooking,
      }, true);

      navigate('/payment');
    } catch (err: any) {
      toast({
        title: 'Unable to continue',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loadingTrain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dfe8f5] px-4">
        <div className="rounded-2xl bg-white px-6 py-4 text-[#244761] shadow-lg">Loading booking...</div>
      </div>
    );
  }

  if (!train) return null;

  const totalFare = train.fare * passengers.length;

  return (
    <div className="min-h-screen bg-[#dfe8f5] py-8">
      <div className="mx-auto max-w-5xl px-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/search')}
          className="mb-6 rounded-full text-[#244761] hover:bg-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Search
        </Button>

        <div className="space-y-6">
          <Card className="rounded-2xl border-0 bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5] p-6 text-white shadow-lg">
            <h2 className="text-2xl font-bold">
              {train.trainName} ({train.trainNumber})
            </h2>
            <p className="mt-1 text-sm text-white/85">Complete passenger details to continue</p>
          </Card>

          <Card className="rounded-2xl border-0 bg-white p-6 shadow-lg">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-[#113454]">Passenger Details</h3>
              <Button
                onClick={addPassenger}
                disabled={passengers.length >= 6}
                variant="outline"
                className="rounded-full border-[#d8e2ef]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Passenger
              </Button>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#d8e2ef] bg-[#f8fbff] p-3">
              <Checkbox
                id="family-booking"
                checked={isFamilyBooking}
                onCheckedChange={(checked) => setIsFamilyBooking(!!checked)}
              />
              <Label htmlFor="family-booking" className="text-[#41586f]">
                Traveling as family (required for mixed-gender booking)
              </Label>
            </div>

            <div className="space-y-4">
              {passengers.map((passenger, index) => (
                <div key={index} className="relative rounded-xl border border-[#d8e2ef] bg-[#f8fbff] p-4">
                  {passengers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-2 text-[#7a8ea4] hover:bg-white"
                      onClick={() => removePassenger(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[#617286]">Name</Label>
                      <Input
                        value={passenger.name}
                        className="h-11 rounded-xl border-[#d8e2ef] bg-white"
                        onChange={(e) => updatePassenger(index, 'name', e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[#617286]">Age</Label>
                      <Input
                        type="number"
                        value={passenger.age || ''}
                        className="h-11 rounded-xl border-[#d8e2ef] bg-white"
                        onChange={(e) =>
                          updatePassenger(index, 'age', parseInt(e.target.value) || 0)
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[#617286]">Gender</Label>
                      <Select
                        value={passenger.gender}
                        onValueChange={(value) => updatePassenger(index, 'gender', value)}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-[#d8e2ef] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="space-y-1.5">
                      <Label className="text-[#617286]">Berth Preference</Label>
                      <Select
                        value={passenger.berth}
                        onValueChange={(value) => updatePassenger(index, 'berth', value)}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-[#d8e2ef] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="No Preference">No Preference</SelectItem>
                          <SelectItem value="Lower">Lower</SelectItem>
                          <SelectItem value="Middle">Middle</SelectItem>
                          <SelectItem value="Upper">Upper</SelectItem>
                          <SelectItem value="Side Lower">Side Lower</SelectItem>
                          <SelectItem value="Side Upper">Side Upper</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-2xl border-0 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between text-lg font-bold">
              <span className="text-[#244761]">Total Amount</span>
              <span className="flex items-center text-2xl text-[#1f78de]">
                <IndianRupee className="h-5 w-5" />
                {totalFare}
              </span>
            </div>
          </Card>

          <Button
            onClick={handleProceedToPayment}
            className="h-12 w-full rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]"
            size="lg"
          >
            Proceed to Payment
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Booking;
