'use client';

import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Story } from '../firestoreSchemas'; // Assuming you have a Story schema

interface UserData {
  consentFlags: {
    research: boolean;
  };
  flags: {
    freeElderAccess: boolean;
    // other flags
  };
  // other user data
}

export default function ProfilePage() {
  const [userUID, setUserUID] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReplaying, setIsReplaying] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loadingStories, setLoadingStories] = useState(true);
  const [groupingCriteria, setGroupingCriteria] = useState<'None' | 'Domain' | 'Tag'>('None');

  // Listen for auth state changes
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserUID(user ? user.uid : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch user data
  useEffect(() => {
    if (userUID) {
      const fetchUserData = async () => {
        try {
          const userRef = doc(db, 'users', userUID);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          } else {
            // Handle case where user document doesn't exist
            setUserData(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserData(null);
        }
      };
      fetchUserData();
    } else {
      setUserData(null);
    }
  }, [userUID]);

  // Fetch user stories
  useEffect(() => {
    if (userUID) {
      const fetchUserStories = async () => {
        setLoadingStories(true);
        try {
          const storiesCollection = collection(db, 'stories');
          const q = query(storiesCollection, where('authorUID', '==', userUID));
          const querySnapshot = await getDocs(q);
          const storiesData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Story));
          setUserStories(storiesData);
        } catch (error) {
          console.error('Error fetching user stories:', error);
          setUserStories([]);
        } finally {
          setLoadingStories(false);
        }
      };
      fetchUserStories();
    } else {
      setUserStories([]);
      setLoadingStories(false);
    }
  }, [userUID]);

  const sortedStories = useMemo(() => {
    let storiesToGroup = [...userStories];

    // Sort by date first
    storiesToGroup.sort((a, b) => {
      // Assuming 'createdAt' is stored as a Timestamp or Date object
      // If stored as a Firestore Timestamp, you might need to convert to Date
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toDate().getTime() || 0;
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toDate().getTime() || 0;
      return dateA - dateB;
    });

    if (groupingCriteria === 'Domain') {
      // Group by domain (this will just sort by domain for display in replay)
      storiesToGroup.sort((a, b) => {
        const domainA = a.domain || ''; // Assuming domain is a field in Story
        const domainB = b.domain || '';
        return domainA.localeCompare(domainB);
      });
    } else if (groupingCriteria === 'Tag') {
      // Flatten by tags
      let taggedStories: Story[] = [];
      storiesToGroup.forEach(story => {
        if (story.anchorTags && story.anchorTags.length > 0) {
          story.anchorTags.forEach(tag => {
            // Create a new story object for each tag to display them individually
            taggedStories.push({ ...story, anchorTags: [tag], id: `${story.id}-${tag}` }); // Add tag to ID for uniqueness
          });
        } else {
          taggedStories.push(story); // Include stories with no tags
        }
      });
      // Re-sort flattened list by date
      taggedStories.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toDate().getTime() || 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toDate().getTime() || 0;
        return dateA - dateB;
      });      storiesToGroup = taggedStories;
    }

    return storiesToGroup;
  }, [userStories, groupingCriteria]);


  const handleReplayStories = () => {
    setIsReplaying(true);
    setCurrentStoryIndex(0);
  };
  const handleResearchConsentToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!userUID || !userData) return;

    const isChecked = event.target.checked;
    try {
      const userRef = doc(db, 'users', userUID);
      await updateDoc(userRef, {
        'consentFlags.research': isChecked,
      });
      setUserData(prevData => {
        if (!prevData) return null;
        return {
          ...prevData,
          consentFlags: {
            ...prevData.consentFlags,
            research: isChecked,
          },
        };
      });
      console.log('Research consent updated successfully.');
    } catch (error) {
      console.error('Error updating research consent:', error);
    }
  };

  const handleToggleStoryPublicStatus = async (storyId: string, currentStatus: boolean) => {
    if (!userUID) return;

    try {
      const storyRef = doc(db, 'stories', storyId);
      await updateDoc(storyRef, {
        isPublic: !currentStatus,
      });
      setUserStories(prevStories =>
        prevStories.map(story =>
          story.id === storyId ? { ...story, isPublic: !currentStatus } : story
        )
      );
      console.log(`Story ${storyId} public status toggled.`);
    } catch (error) {
      console.error('Error toggling story public status:', error);
    }
  };

  const handleNextStory = () => {
    setCurrentStoryIndex((prevIndex) => (prevIndex + 1) % sortedStories.length);
  };

  const handlePreviousStory = () => {
    setCurrentStoryIndex((prevIndex) =>
      prevIndex === 0 ? sortedStories.length - 1 : prevIndex - 1
    );
  };

  const handleStopReplay = () => {
    setIsReplaying(false);
    setCurrentStoryIndex(0); // Reset index when stopping
  };

  const handleGroupingChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setGroupingCriteria(event.target.value as 'None' | 'Domain' | 'Tag');
    setCurrentStoryIndex(0); // Reset index when grouping changes
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading profile...</div>;
  }

  if (!userUID) {
    return <div className="min-h-screen flex items-center justify-center">Please sign in to view your profile.</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">User Profile</h1>

      {userData && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Privacy Settings</h2>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="researchConsent"
              checked={userData.consentFlags?.research || false}
              onChange={handleResearchConsentToggle}
              className="mr-2"
            />
            <label htmlFor="researchConsent">Allow anonymized stories to be used for memory research</label>
          </div>
        </div>
      )}

      {isReplaying ? (
        // Memory Replay Interface
        <div className="mb-8 border p-4 rounded-md">
          <h2 className="text-xl font-semibold mb-4">Memory Replay</h2>
          <div className="mb-4">
            <label htmlFor="groupingCriteria" className="mr-2">Group by:</label>
            <select
              id="groupingCriteria"
              value={groupingCriteria}
              onChange={handleGroupingChange}
              className="p-1 border rounded"
            >
              <option value="None">None</option>
              <option value="Domain">Domain</option>
              <option value="Tag">Tag</option>
            </select>
          </div>
          {sortedStories.length > 0 ? (
            <div className="flex flex-col">
              <p className="text-lg mb-4">{sortedStories[currentStoryIndex].text}</p>
              <p className="text-sm text-gray-600">
                Date: {sortedStories[currentStoryIndex].createdAt ? new Date((sortedStories[currentStoryIndex].createdAt as any).toDate()).toLocaleString() : 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                Emotion Score: {sortedStories[currentStoryIndex].emotionScore}
              </p>
              {sortedStories[currentStoryIndex].anchorTags && sortedStories[currentStoryIndex].anchorTags.length > 0 && (
                <p className="text-sm text-gray-600">
                  Tags: {sortedStories[currentStoryIndex].anchorTags.join(', ')}
                </p>
              )}
              {sortedStories[currentStoryIndex].domain && (
                <p className="text-sm text-gray-600">Domain: {sortedStories[currentStoryIndex].domain}</p>
              )}

              <div className="flex justify-between mt-4">
                <button onClick={handlePreviousStory} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Previous
                </button>
                <button onClick={handleNextStory} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Next
                </button>
              </div>
              <button onClick={handleStopReplay} className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                Stop Replay
              </button>
            </div>
          ) : (
            <p>No stories available for replay.</p>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-2">Your Stories</h2>
          <button onClick={handleReplayStories} className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Replay My Stories</button>
          {loadingStories ? (<p>Loading stories...</p>) : userStories.length === 0 ? (<p>You haven't written any stories yet.</p>) : (<ul>{userStories.map(story => (<li key={story.id} className="border-b border-gray-200 py-4"><p className="mb-2">{story.text.substring(0, 200)}...</p> {/* Display snippet */}
                <p className="text-sm text-gray-500">Status: {story.isPublic ? 'Public' : 'Private'}</p>
                <button
                  onClick={() => handleToggleStoryPublicStatus(story.id!, story.isPublic)}
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Make {story.isPublic ? 'Private' : 'Public'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}