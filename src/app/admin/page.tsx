import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // Assuming your firestore instance is exported as 'db' from firebase.js

// Define a type for the metrics data structure
interface DailyMetrics {
  totalsByDomain: { [key: string]: number };
  totalStories: number;
  totalEmotionScore: number;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  };
}

const AdminDashboard: React.FC = () => {
  const [metricsData, setMetricsData] = useState<DailyMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      const metricsCollection = collection(db, 'metrics');
      const metricsSnapshot = await getDocs(metricsCollection);
      const metricsList = metricsSnapshot.docs.map(doc => doc.data() as DailyMetrics);
      setMetricsData(metricsList);
      setLoading(false);
    };

    fetchMetrics();
  }, []);

  // Calculate metrics
  const totalStoriesByDomain: { [key: string]: number } = {};
  let totalStories = 0;
  let totalEmotionScore = 0;
  let storiesToday = 0;
  let storiesThisWeek = 0;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // Start of the current week (Sunday)

  metricsData.forEach(dayMetrics => {
    // Calculate total stories by domain
    for (const domain in dayMetrics.totalsByDomain) {
      if (totalStoriesByDomain[domain]) {
        totalStoriesByDomain[domain] += dayMetrics.totalsByDomain[domain];
      } else {
        totalStoriesByDomain[domain] = dayMetrics.totalsByDomain[domain];
      }
    }

    // Calculate total stories and emotion score
    totalStories += dayMetrics.totalStories || 0;
    totalEmotionScore += dayMetrics.totalEmotionScore || 0;

    // Calculate stories today and this week
    const dayTimestamp = new Date(dayMetrics.timestamp.seconds * 1000);
    if (dayTimestamp >= startOfToday) {
      storiesToday += dayMetrics.totalStories || 0;
    }
    if (dayTimestamp >= startOfWeek) {
      storiesThisWeek += dayMetrics.totalStories || 0;
    }
  });

  const averageEmotionScore = totalStories > 0 ? (totalEmotionScore / totalStories).toFixed(2) : 'N/A';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      {loading ? (
        <p>Loading metrics...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Stories by Domain */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Total Stories by Domain</h2>
            <ul>
              {Object.entries(totalStoriesByDomain).map(([domain, count]) => (
                <li key={domain} className="flex justify-between py-2 border-b last:border-b-0">
                  <span>{domain}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Average Emotion Score */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Average Emotion Score</h2>
            <p className="text-3xl font-bold">{averageEmotionScore}</p>
          </div>

          {/* Stories Today */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Stories Today</h2>
            <p className="text-3xl font-bold">{storiesToday}</p>
          </div>

          {/* Stories This Week */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Stories This Week</h2>
            <p className="text-3xl font-bold">{storiesThisWeek}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;