import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Assuming firebaseConfig.ts contains your Firestore setup

interface Metrics {
  domain: string;
  storyCount: number;
}

interface DailyMetrics {
  [domain: string]: number;
}

interface WeeklyMetrics {
  [domain: string]: number;
}

const AdminDashboard: React.FC = () => {
  const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyMetrics>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeeklyMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const today = new Date();
        const currentDayOfWeek = today.getDay(); // 0 for Sunday, 6 for Saturday
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDayOfWeek); // Start of the current week

        const dailyMetricsData: DailyMetrics[] = [];

        for (let i = 0; i < 7; i++) {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i);
          const dayKey = date.toISOString().split('T')[0]; // Format YYYY-MM-DD

          const metricsRef = collection(db, 'metrics', dayKey, 'domains');
          const querySnapshot = await getDocs(metricsRef);

          const dailyData: DailyMetrics = {};
          querySnapshot.forEach((doc) => {
            const metric = doc.data() as Metrics;
            dailyData[metric.domain] = metric.storyCount;
          });
          dailyMetricsData.push(dailyData);
        }

        const aggregatedWeeklyMetrics: WeeklyMetrics = {};
        dailyMetricsData.forEach((dailyData) => {
          for (const domain in dailyData) {
            if (aggregatedWeeklyMetrics[domain]) {
              aggregatedWeeklyMetrics[domain] += dailyData[domain];
            } else {
              aggregatedWeeklyMetrics[domain] = dailyData[domain];
            }
          }
        });

        setWeeklyMetrics(aggregatedWeeklyMetrics);
      } catch (err) {
        console.error("Error fetching weekly metrics:", err);
        setError("Failed to load weekly metrics.");
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyMetrics();
  }, []);

  if (loading) {
    return <div>Loading weekly metrics...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <h2>Weekly Story Metrics by Domain</h2>
      {Object.keys(weeklyMetrics).length > 0 ? (
        <ul>
          {Object.entries(weeklyMetrics).map(([domain, count]) => (
            <li key={domain}>
              {domain}: {count} stories
            </li>
          ))}
        </ul>
      ) : (
        <p>No story metrics available for this week.</p>
      )}
    </div>
  );
};

export default AdminDashboard;