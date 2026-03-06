import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrainCard } from '@/components/TrainCard';
import { Train } from '@/types/booking';
import { isAuthenticated, logout, getCurrentUser } from '@/utils/auth';
import { api } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Search as SearchIcon, LogOut, User, Ticket, RotateCcw, Shield } from 'lucide-react';

const Search = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [allTrains, setAllTrains] = useState<Train[]>([]);
  const [filteredTrains, setFilteredTrains] = useState<Train[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookingTrainNumber, setBookingTrainNumber] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const user = getCurrentUser();
  const userIdentity = user?.username || user?.email || '';

  const normalize = (value: string) => value.trim().toLowerCase();

  const checkAdminSession = useCallback(async () => {
    try {
      const data = await api<{ isAdmin?: boolean }>('admin/session/', 'GET', undefined, true);
      setIsAdmin(Boolean(data?.isAdmin));
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const loadAllTrains = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ trains: Train[] }>('search-trains/', 'GET', undefined, true);
      const trains = data.trains || [];
      setAllTrains(trains);
      setFilteredTrains(trains);
      setShowResults(false);
      setLoadError(null);
    } catch (err: any) {
      const message = err?.message || 'Please try again.';
      setLoadError(message);
      toast({
        title: 'Unable to load trains',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/auth');
      return;
    }

    loadAllTrains();
    checkAdminSession();
  }, [navigate, loadAllTrains, checkAdminSession]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    const sourceQuery = normalize(source);
    const destinationQuery = normalize(destination);

    if (!sourceQuery || !destinationQuery) {
      toast({
        title: 'Missing fields',
        description: 'Enter both source and destination.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const data = await api<{ trains: Train[] }>(
        `search-trains/?source=${encodeURIComponent(sourceQuery)}&destination=${encodeURIComponent(destinationQuery)}`,
        'GET',
        undefined,
        true
      );
      const matches = data.trains || [];
      setFilteredTrains(matches);
      setShowResults(true);
      setLoadError(null);

      if (matches.length === 0) {
        toast({
          title: 'No trains found',
          description: 'Try different station names.',
        });
      }
    } catch (err: any) {
      const fallbackMatches = allTrains.filter((train) => {
        const trainSource = normalize(train.source || '');
        const trainDestination = normalize(train.destination || '');
        return trainSource.includes(sourceQuery) && trainDestination.includes(destinationQuery);
      });

      setFilteredTrains(fallbackMatches);
      setShowResults(true);

      toast({
        title: 'Search issue',
        description:
          fallbackMatches.length > 0
            ? 'Live search is slow right now. Showing cached train results.'
            : err?.message || 'Please try again.',
        variant: fallbackMatches.length > 0 ? 'default' : 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSource('');
    setDestination('');
    setFilteredTrains(allTrains);
    setShowResults(false);

    if (!allTrains.length) {
      loadAllTrains();
    }
  };

  const handleBook = async (train: Train) => {
    const currentUser = getCurrentUser();
    const identity = currentUser?.username || currentUser?.email;
    if (!identity) {
      navigate('/auth');
      return;
    }

    try {
      setBookingTrainNumber(train.trainNumber);
      await api('select-train/', 'POST', { email: identity, train }, true);
      navigate('/booking');
    } catch (err: any) {
      toast({
        title: 'Unable to continue',
        description: err?.message || 'Could not select train. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBookingTrainNumber(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#dfe8f5]">
      <header className="bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5] text-white shadow-lg">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Ticket className="h-8 w-8 text-white" />
              <h1 className="text-2xl font-bold tracking-wide">KITS RailBook</h1>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Button
                variant="ghost"
                className="max-w-full rounded-full text-white hover:bg-white/15 sm:max-w-[280px]"
                onClick={() => navigate('/profile')}
              >
                <User className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{userIdentity}</span>
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="rounded-full text-white hover:bg-white/15"
                  onClick={() => navigate('/admin-panel')}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Admin
                </Button>
              )}
              <Button
                variant="ghost"
                className="rounded-full text-white hover:bg-white/15"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5] pb-16 pt-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-3xl font-bold text-white">Search Trains</h2>

            <form onSubmit={handleSearch} className="rounded-2xl border border-white/25 bg-white/95 p-5 shadow-2xl backdrop-blur sm:p-6">
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="space-y-1.5 lg:col-span-1">
                  <Label htmlFor="source" className="text-[#617286]">From</Label>
                  <Input
                    id="source"
                    placeholder="Enter source station"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    required
                    className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label htmlFor="destination" className="text-[#617286]">To</Label>
                  <Input
                    id="destination"
                    placeholder="Enter destination station"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                    className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                  />
                </div>

                <div className="flex items-end lg:col-span-1">
                  <Button type="submit" className="h-12 w-full rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]" size="lg" disabled={loading}>
                    <SearchIcon className="mr-2 h-4 w-4" />
                    Search Trains
                  </Button>
                </div>

                <div className="flex items-end lg:col-span-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="h-12 w-full rounded-full border-[#d8e2ef]"
                    disabled={loading}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Show All
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-[#113454]">
            {showResults ? 'Search Results' : 'Available Trains'} ({filteredTrains.length})
          </h3>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white py-14 text-center shadow-sm">
            <p className="text-[#617286]">Loading trains...</p>
          </div>
        ) : filteredTrains.length === 0 ? (
          <div className="rounded-2xl bg-white py-14 text-center shadow-sm">
            <p className="text-[#617286]">{loadError ? 'Unable to load trains right now' : 'No trains found'}</p>
            {loadError && (
              <div className="mt-4">
                <Button onClick={loadAllTrains} className="rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]">
                  Retry
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTrains.map((train) => (
              <div key={train.trainNumber} className={bookingTrainNumber === train.trainNumber ? 'opacity-70' : ''}>
                <TrainCard train={train} onBook={handleBook} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Search;
