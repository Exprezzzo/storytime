typescriptreact
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust the import path as needed
import { Story } from '../../../firestoreSchemas'; // Adjust the import path as needed

const PublicStoryViewer = () => {
  const { storyId } = useParams();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId || typeof storyId !== 'string') {
        setError('Invalid story ID.');
        setLoading(false);
        return;
      }

      try {
        const storyRef = doc(db, 'stories', storyId);
        const storySnap = await getDoc(storyRef);

        if (storySnap.exists()) {
          const storyData = storySnap.data() as Story;
          if (storyData.isPublic) {
            setStory(storyData);
          } else {
            setError('Story not found or not public.');
          }
        } else {
          setError('Story not found or not public.');
        }
      } catch (err) {
        console.error('Error fetching story:', err);
        setError('Error fetching story.');
      } finally {
        setLoading(false);
      }
    };

    fetchStory();
  }, [storyId]);

  if (loading) {
    return <div>Loading story...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!story) {
    return <div>Story not found or not public.</div>;
  }

  // Function to format Firestore Timestamp to a readable date string
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return 'Invalid Date';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Public Story</h1>
      <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <p className="text-gray-800 dark:text-gray-200 mb-4">{story.text}</p>
        <div className="flex items-center mb-2">
          <span className="font-semibold mr-2">Emotion Score:</span>
          <span>{story.emotionScore}</span>
        </div>
        <div className="flex items-center mb-2">
          <span className="font-semibold mr-2">Anchor Tags:</span>
          <div className="flex flex-wrap gap-2">
            {story.anchorTags.map((tag, index) => (
              <span key={index} className="bg-blue-200 dark:bg-blue-700 px-2 py-1 rounded-full text-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Published on: {formatTimestamp(story.seal?.proof)} {/* Assuming seal.proof contains creation timestamp */}
        </div>
      </div>
    </div>
  );
};

export default PublicStoryViewer;