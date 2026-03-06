import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser, isAuthenticated, logout } from '@/utils/auth';
import { api } from '@/utils/api';
import { ArrowLeft, RefreshCw, Shield, Users } from 'lucide-react';

type AdminMetrics = {
  users: { total: number; active: number; staff: number };
  bookings: { total: number; confirmed: number; cancelled: number };
  revenue: { total: string };
  security: { loginAttempts24h: number; failedLogins24h: number };
};

type AdminUser = {
  id: number;
  username: string;
  email: string;
  isActive: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  dateJoined: string;
  lastLogin: string | null;
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const user = getCurrentUser();
  const userIdentity = user?.username || user?.email || '';

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const summaryCards = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: 'Users', value: String(metrics.users.total) },
      { label: 'Active Users', value: String(metrics.users.active) },
      { label: 'Staff Users', value: String(metrics.users.staff) },
      { label: 'Bookings', value: String(metrics.bookings.total) },
      { label: 'Revenue', value: `Rs ${metrics.revenue.total}` },
      { label: 'Failed Logins (24h)', value: String(metrics.security.failedLogins24h) },
    ];
  }, [metrics]);

  const loadAdminData = useCallback(async (search = '') => {
    const [metricsRes, usersRes] = await Promise.all([
      api<{ success: boolean; metrics: AdminMetrics }>('admin/analytics/', 'GET', undefined, true),
      api<{ success: boolean; users: AdminUser[] }>(
        `admin/users/${search ? `?q=${encodeURIComponent(search)}` : ''}`,
        'GET',
        undefined,
        true
      ),
    ]);

    setMetrics(metricsRes.metrics);
    setUsers(usersRes.users || []);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated()) {
        navigate('/auth');
        return;
      }

      try {
        const session = await api<{ success: boolean; isAdmin: boolean }>('admin/session/', 'GET', undefined, true);
        if (!session.isAdmin) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);
        await loadAdminData('');
      } catch (err: any) {
        toast({
          title: 'Unable to open admin panel',
          description: err?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate, toast, loadAdminData]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loadAdminData(query);
    } catch (err: any) {
      toast({
        title: 'Search failed',
        description: err?.message || 'Unable to fetch users.',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (target: AdminUser, field: 'isActive' | 'isStaff', value: boolean) => {
    try {
      setSavingUserId(target.id);
      const res = await api<{ success: boolean; user: AdminUser }>(
        `admin/users/${target.id}/`,
        'POST',
        { [field]: value },
        true
      );

      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, ...res.user } : u)));
      toast({
        title: 'User updated',
        description: `${target.username} has been updated.`,
      });
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err?.message || 'Could not update user.',
        variant: 'destructive',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await loadAdminData(query);
    } catch (err: any) {
      toast({
        title: 'Refresh failed',
        description: err?.message || 'Could not refresh admin data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dfe8f5] px-4">
        <div className="rounded-2xl bg-white px-6 py-4 text-[#244761] shadow-lg">Loading admin panel...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dfe8f5] px-4">
        <Card className="w-full max-w-lg rounded-2xl border-0 bg-white p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-[#113454]">Admin access required</h2>
          <p className="mt-2 text-sm text-[#617286]">
            Logged in as {userIdentity || 'unknown user'}. This account does not have admin privileges.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/search')} className="rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]">
              Back to Search
            </Button>
            <Button variant="outline" onClick={handleLogout} className="rounded-full border-[#d8e2ef] bg-white">
              Logout
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#dfe8f5] py-6">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate('/search')} className="rounded-full text-[#244761] hover:bg-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} className="rounded-full border-[#d8e2ef] bg-white">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleLogout} className="rounded-full border-[#d8e2ef] bg-white">
              Logout
            </Button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5] p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7" />
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-white/90">User management and security analytics</p>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((card) => (
            <Card key={card.label} className="rounded-2xl border-0 bg-white p-4 shadow-sm">
              <p className="text-sm text-[#617286]">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#113454]">{card.value}</p>
            </Card>
          ))}
        </div>

        <Card className="mb-4 rounded-2xl border-0 bg-white p-4 shadow-sm">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or email"
              className="h-11 rounded-xl border-[#d8e2ef] bg-white"
            />
            <Button type="submit" className="h-11 rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]">
              <Users className="mr-2 h-4 w-4" />
              Search Users
            </Button>
          </form>
        </Card>

        <Card className="rounded-2xl border-0 bg-white p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-[#eef5ff] text-[#35506a]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Username</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Active</th>
                  <th className="px-4 py-3 font-semibold">Staff</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[#edf2f8]">
                    <td className="px-4 py-3 text-[#113454]">{u.username}</td>
                    <td className="px-4 py-3 text-[#617286]">{u.email || '-'}</td>
                    <td className="px-4 py-3 text-[#617286]">{u.isSuperuser ? 'Superuser' : u.isStaff ? 'Staff' : 'User'}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={u.isActive ? 'default' : 'outline'}
                        disabled={savingUserId === u.id}
                        className={u.isActive ? 'rounded-full bg-green-600 text-white hover:bg-green-700' : 'rounded-full border-[#d8e2ef] bg-white'}
                        onClick={() => handleToggle(u, 'isActive', !u.isActive)}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={u.isStaff ? 'default' : 'outline'}
                        disabled={savingUserId === u.id || u.isSuperuser}
                        className={u.isStaff ? 'rounded-full bg-[#1f78de] text-white hover:bg-[#1668c2]' : 'rounded-full border-[#d8e2ef] bg-white'}
                        onClick={() => handleToggle(u, 'isStaff', !u.isStaff)}
                      >
                        {u.isStaff ? 'Staff' : 'Make Staff'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminPanel;
