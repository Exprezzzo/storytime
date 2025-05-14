'use client';

import Image from "next/image";
import { createHash } from 'crypto';
import { db } from './firebase'; // Assuming you have a firebase.js or similar file exporting 'db'
import { doc, setDoc } from 'firebase/firestore';
import { useState, useEffect, ChangeEvent, useCallback, useMemo, MouseEvent } from 'react';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDoc, collection, getDocs } from 'firebase/firestore';
import { FiMic, FiMicOff } from 'react-icons/fi'; // Import microphone icons
import { Story } from './firestoreSchemas'; // Import Story schema

interface Prompt {
  promptText: string;
  category: string;
  tags: string[];
  language: string;
}

type Domain = "personal" | "health" | "education" | "legal" | "marketing";

// Basic sentiment analysis function
function getEmotionScore(text: string): number {
  // This is a very basic implementation. A real-world scenario would use a more sophisticated library or API.
  const positiveWords = ['happy', 'joy', 'love', 'great', 'good', 'wonderful', 'amazing', 'excited'];
  const negativeWords = ['sad', 'angry', 'bad', 'terrible', 'horrible', 'frustrated', 'depressed'];

  let score = 0;
  const words = text.toLowerCase().split(/\W+/);

  words.forEach(word => {
    if (positiveWords.includes(word)) score++;
    else if (negativeWords.includes(word)) score--;
  });

  // Map score to a 1-5 scale (very basic mapping)
  if (score > 2) return 5;
  if (score > 0) return 4;
  if (score === 0) return 3;
  if (score < 0 && score > -3) return 2;
  return 1;
}

interface TenantBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  // Add other branding properties as needed
}

export default function Home() {
  const [journalEntry, setJournalEntry] = useState(''); // State for the journal entry text
  const [userUID, setUserUID] = useState<string | null>(null); // State to hold the authenticated user's UID
  const [isRecording, setIsRecording] = useState(false); // State to track recording status
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null); // State to hold the SpeechRecognition instance
  const [anchorTagInput, setAnchorTagInput] = useState(''); // State for the anchor tag input
  const [selectedDomain, setSelectedDomain] = useState<Domain>('personal'); // State for the selected domain
  const [anchorTags, setAnchorTags] = useState<string[]>([]); // State to hold the list of anchor tags
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null); // State to hold the current prompt
  const [birthYear, setBirthYear] = useState<string>(''); // State for birth year input
  const [userData, setUserData] = useState<any>(null); // State to hold user data from Firestore
  const [tenantId, setTenantId] = useState<string | null>(null); // State to hold the tenant ID
  const [tenantBranding, setTenantBranding] = useState<TenantBranding | null>(null); // State to hold tenant branding data
  const [isPublic, setIsPublic] = useState(false); // State for the "Make this story public" checkbox

  // Use useSearchParams directly
  const { useSearchParams } = require('next/navigation');
  const searchParams = useSearchParams();
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);

  // Authenticate anonymously on component mount
  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) { // User is signed in, do nothing
        console.log("User signed in anonymously:", user.uid);
        setIsLoadingUser(false);
        setUserUID(user.uid);
      } else { // User is signed out, sign in anonymously
        signInAnonymously(auth);
      }
    }); // Removed .catch here

    // Moved .catch to chain after signInAnonymously
    auth.signInAnonymously(auth).catch((error) => {
        console.error("Error signing in anonymously:", error);
      });

    // Initialize SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US'; // Set language

      recognizer.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        setJournalEntry((prevEntry) => prevEntry + finalTranscript); // Append final transcript
      };

      recognizer.onerror = (event) => {
        console.error('Speech recognition error', event);
        setIsRecording(false);
      };

      setRecognition(recognizer);
    } else {
      console.error('Speech recognition not supported in this browser.');
    }
  }, []);

  // Get tenant ID from URL and fetch branding
  useEffect(() => {
    const tenant = searchParams.get('tenant');
    setIsLoadingBranding(true);
    if (tenant) {
      setTenantId(tenant);
      const fetchTenantBranding = async () => {
        try {
          const tenantRef = doc(db, 'tenants', tenant);
          const tenantDoc = await getDoc(tenantRef);
          if (tenantDoc.exists() && tenantDoc.data().branding) {
            setTenantBranding(tenantDoc.data().branding as TenantBranding);
          } else {
            console.log("No branding found for tenant:", tenant);
            setTenantBranding(null);
          }
          setIsLoadingBranding(false);
        } catch (error) {
          console.error("Error fetching tenant branding:", error);
          setIsLoadingBranding(false);
        }
      };
      fetchTenantBranding();
    } else {
      fetchTenantBranding();
    }
  }, []);

  // Fetch user data on authentication
  useEffect(() => {
    if (userUID) {
      setIsLoadingUser(true);
      const fetchUserData = async () => {
        try {
          const userRef = doc(db, 'users', userUID);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            console.log("User data fetched:", userDoc.data());
            setUserData(userDoc.data());
          } else {
            // Create user document if it doesn't exist (for new anonymous users)
            await setDoc(userRef, { consentFlags: { research: false }, flags: { freeElderAccess: false } });
            setUserData({ consentFlags: { research: false }, flags: { freeElderAccess: false } });
          }
        } catch (error) {
          setIsLoadingUser(false);
          console.error("Error fetching user data:", error);
        } finally {
          setIsLoadingUser(false);
        }

      };
      fetchUserData();

    }
  }, [userUID]);
  // Fetch a random prompt based on the selected domain
  const fetchRandomPrompt = useCallback(async () => {
    if (tenantId) {
      // Check for tenant-specific prompts
      const tenantPromptsRef = collection(db, `tenants/${tenantId}/prompts/${selectedDomain}/questions`);
      const tenantSnapshot = await getDocs(tenantPromptsRef);
      const snapshot = await getDocs(promptsRef);
      if (!snapshot.empty) {
        const randomIndex = Math.floor(Math.random() * snapshot.docs.length);
        setCurrentPrompt(snapshot.docs[randomIndex].data() as Prompt);
      } else {
        setCurrentPrompt(null); // No prompts found for this domain
      }
      if (!tenantSnapshot.empty) {
        promptsCollectionPath = `tenants/${tenantId}/prompts/${selectedDomain}/questions`;
      }
      setIsLoadingPrompt(true);
    }

    try {
      const promptsRef = collection(db, promptsCollectionPath);
      const snapshot = await getDocs(promptsRef);

      if (!snapshot.empty) {
        const randomIndex = Math.floor(Math.random() * snapshot.docs.length);
        setCurrentPrompt(snapshot.docs[randomIndex].data() as Prompt);
      } else {
        setCurrentPrompt(null); // No prompts found for this domain
        setIsLoadingPrompt(false);
      }
    } catch (error) {
      setIsLoadingPrompt(false);

      console.error("Error fetching prompts:", error);
      setCurrentPrompt(null);
    }
  }, [selectedDomain]); // Dependency array ensures this runs when selectedDomain changes

  // Fetch prompt when domain changes
  useEffect(() => {
    fetchRandomPrompt();
  }, [selectedDomain, fetchRandomPrompt]);

  const handleRefreshPrompt = () => {
    fetchRandomPrompt();
  };


  const handleSaveEntry = async () => {
    try {
    const emotionScore = getEmotionScore(journalEntry);
    let tagsToSave = [...anchorTags]; // Start with user-added tags

    if (currentPrompt && currentPrompt.tags) {
      // Append prompt tags and ensure uniqueness
      tagsToSave = Array.from(new Set([...tagsToSave, ...currentPrompt.tags]));
    }

    const storyData: Story = {
      authorUID: userUID!, // Use the authenticated user's UID
      text: journalEntry,
      emotionScore: emotionScore,
      anchorTags: tagsToSave,
 isPublic: isPublic, // Set public status from state
      seal: { hash: '', proof: '' }, // Placeholder seal

    }; // Closing the storyData object definition
      await setDoc(newStoryRef, storyData);
      console.log("Journal entry saved successfully!");
      setJournalEntry(''); // Clear the textarea after saving
      setIsPublic(false); // Reset public status
    } catch (error) {
      console.error("Error saving journal entry:", error);
    }
  };

  const handleVoiceJournaling = () => {
    if (!recognition) {
      console.error('Speech recognition not initialized.');
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      console.log('Speech recognition stopped.');
    } else {
      recognition.start();
      setIsRecording(true);
      console.log('Speech recognition started.');
      setJournalEntry(journalEntry + ' '); // Add a space before starting new transcription
    }
  };

  const handleSaveBirthYear = async () => {
    if (!userUID) {
      console.error("User not authenticated.");
      return;
    }

    const year = parseInt(birthYear, 10);
    if (isNaN(year)) {
      console.error("Invalid birth year.");
      return;
    }

    const freeElderAccess = year < 1935;

    try {
      const userRef = doc(db, 'users', userUID);
      await setDoc(userRef, {
        flags: { freeElderAccess: freeElderAccess }
      }, { merge: true }); // Use merge: true to avoid overwriting other fields
      console.log("Birth year saved and freeElderAccess flag set:", freeElderAccess);
    } catch (error) {
      console.error("Error saving birth year:", error);
    }
  };

  const handleDomainChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedDomain(event.target.value as Domain);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && anchorTagInput.trim() !== '') {
      setAnchorTags([...anchorTags, anchorTagInput.trim()]);
      setAnchorTagInput('');
      e.preventDefault(); // Prevent form submission
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="fixed top-0 left-0 w-full bg-yellow-200 text-center text-sm py-1 z-50">
        This is a pre-release prototype. Some features may be limited.
      </div>
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        {isLoadingBranding ? (
          <div className="animate-pulse h-10 w-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
        ) : tenantBranding?.logoUrl ? (
          <img src={tenantBranding.logoUrl} alt="Tenant Logo" className="h-10" />
        ) : (
          <Image
            className="dark:invert"
            src="/next.svg"
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        }

        <ol className="list-inside list-decimal text-sm/6 text-center sm:text-left font-[family-name:var(--font-geist-mono)]" style={{ color: tenantBranding?.primaryColor }}>
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-[family-name:var(--font-geist-mono)] font-semibold">
              src/app/page.tsx
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
          <li>
            Write your journal entry below:
          </li>
          <li>
            <label htmlFor="domain-select">Select a domain:</label>
            Select a domain:
            <select
              value={selectedDomain}
              onChange={handleDomainChange}
              className="ml-2 p-1 border rounded dark:bg-gray-800 dark:border-gray-600"
              style={{
                borderColor: tenantBranding?.primaryColor,
                outlineColor: tenantBranding?.primaryColor,
              }}
            >
              <option value="personal">Personal</option>
              <option value="health">Health</option>
              <option value="education">Education</option>
              <option value="legal">Legal</option>
              <option value="marketing">Marketing</option>
            </select>
          </li>

        </ol>

        {tenantId && (
          <p className="text-sm text-gray-600 dark:text-gray-400" style={{ color: tenantBranding?.secondaryColor }}>
            Tenant: {tenantId}
          </p>
        )}

        <div className="flex gap-4 items-center" style={{ color: tenantBranding?.secondaryColor }}>
          <label htmlFor="birthYear">Birth Year:</label> {/* Added closing label tag */}
          <input
            type="number"
            id="birthYear"
            className="p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="e.g., 1920"
            aria-label="Birth Year"
          />
          <button
            onClick={handleSaveBirthYear}
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            style={{ backgroundColor: tenantBranding?.primaryColor, color: tenantBranding?.secondaryColor }}>Save Birth Year</button>
        </div>

        {isLoadingPrompt ? (
          <div className="animate-pulse h-6 w-64 bg-gray-300 dark:bg-gray-700 rounded"></div>
        ) : currentPrompt && (
          <p className="text-lg italic text-center sm:text-left">{`Memory Cue: "${currentPrompt.promptText}"`}</p>
        )}

        <textarea
          className="w-full p-4 border rounded-md dark:bg-gray-800 dark:border-gray-600"
          aria-label="Journal Entry"
          style={{
            borderColor: tenantBranding?.primaryColor,
            outlineColor: tenantBranding?.primaryColor,
          }}
          rows={8} // Reduced rows for better initial view on smaller screens
          value={journalEntry}
          onChange={(e) => setJournalEntry(e.target.value)}
        ></textarea>

        <input
          type="text"
          className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
          aria-label="Add anchor tags"
          style={{
            borderColor: tenantBranding?.primaryColor,
          }}
          placeholder="Add anchor tags (press Enter)"
          placeholder="Add anchor tags (press Enter)"
          value={anchorTagInput}
          onChange={(e) => setAnchorTagInput(e.target.value)}
          onKeyDown={handleAddTag}
        />

        <div className="flex flex-wrap gap-2">
          {anchorTags.map((tag, index) => (
            <span key={index} className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full text-sm">{tag}</span>
          ))}
        </div>


        {currentPrompt && (
          <button
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            onClick={handleRefreshPrompt}
            style={{ backgroundColor: tenantBranding?.primaryColor, color: tenantBranding?.secondaryColor }}
          >Refresh Prompt
          </button>

        )}


        <div className="flex gap-4 items-center">
          <button
            className={`rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 ${isRecording ? 'bg-red-500 text-white hover:bg-red-600' : ''}`}
            onClick={handleVoiceJournaling}
            disabled={!recognition}
            aria-label={isRecording ? "Stop Recording" : "Start Recording Voice Journal"}
          >
            {isRecording ? <FiMicOff size={20} /> : <FiMic size={20} />}
          </button>

        </div>
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="makePublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mr-2 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="makePublic" className="text-sm cursor-pointer">Make this story public</label>
          </div>
          {userData && userData.flags && userData.flags.freeElderAccess && (
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">Legacy Member</span>
          )}
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Deploy to Vercel"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Read Next.js documentation"
          >
            Read our docs
          </a>

          <button
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            onClick={handleSaveEntry}
          >

            Save Entry
          </button>


        </div>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
            aria-hidden
            aria-label="Learn Next.js"
            src="/file.svg"
 href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View Next.js examples"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Go to nextjs.org"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
