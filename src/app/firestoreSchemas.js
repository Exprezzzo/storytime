// storytime/src/app/firestoreSchemas.js

export const storySchema = {
  authorUID: String,
  text: String,
  anchorTags: Array,
  emotionScore: Number,
  isPublic: Boolean,
  seal: {
    hash: String,
    proof: String,
  },
};

export const userSchema = {
  consentFlags: {
    research: Boolean,
  },
  flags: {
    freeElderAccess: Boolean,
  },
};