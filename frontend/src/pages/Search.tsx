import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrainCard } from '@/components/TrainCard';
import { Train } from '@/types/booking';
import { isAuthenticated, logout, getCurrentUser } from '@/utils/auth';
import { api } from '@/utils/api';
import { Search as SearchIcon, LogOut, User, Ticket } from 'lucide-react';

const Search = () => {
  const navigate = useNavigate();
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [filteredTrains, setFilteredTrains] = useState<Train[]>([]);
  const [showResults, setShowResults] = useState(false);
  const user = getCurrentUser();
  const userIdentity = user?.username || user?.email || '';

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/auth');
      return;
    }

    loadAllTrains();
  }, [navigate]);

  const loadAllTrains = async () => {
    try {
      const data = await api<{ trains: Train[] }>(
        'search-trains/',
        'GET',
        undefined,
        true
      );

      setFilteredTrains(data.trains || []);
    } catch {
      navigate('/auth');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!source || !destination) return;

    try {
      const data = await api<{ trains: Train[] }>(
        'search-trains/',
        'POST',
        { source, destination },
        true
      );

      setFilteredTrains(data.trains || []);
      setShowResults(true);
    } catch (err) {
      console.error(err);
    }
  };
  const handleBook = async (train: Train) => {
    const user = getCurrentUser();
    const identity = user?.username || user?.email;
    if (!identity) {
      navigate('/auth');
      return;
    }

    await api('select-train/', 'POST', {
      email: identity,
      train
    }, true);

    navigate('/booking');
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
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="rounded-full text-white hover:bg-white/15"
                onClick={() => navigate('/profile')}
              >
                <User className="mr-2 h-4 w-4" />
                {userIdentity}
              </Button>
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
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
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

                <div className="space-y-1.5">
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

                <div className="flex items-end">
                  <Button type="submit" className="h-12 w-full rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]" size="lg">
                    <SearchIcon className="mr-2 h-4 w-4" />
                    Search Trains
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

        {filteredTrains.length === 0 ? (
          <div className="rounded-2xl bg-white py-14 text-center shadow-sm">
            <p className="text-[#617286]">No trains found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTrains.map(train => (
              <TrainCard key={train.trainNumber} train={train} onBook={handleBook} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Search;
