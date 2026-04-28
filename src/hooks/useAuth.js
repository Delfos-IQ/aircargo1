import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase.js';

/**
 * Manages authentication state.
 *
 * Lookup strategy (supports both old and new accounts):
 *  1. Try userProfiles/{uid}  — new accounts created with setDoc + UID as doc ID
 *  2. Fall back to query where email == user.email — legacy accounts created with addDoc
 *
 * Returns: currentUser, currentUserProfile, isLoading, login, logout
 */
export const useAuth = () => {
  const [currentUser,        setCurrentUser]        = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [isLoading,          setIsLoading]          = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // ── 1. Try UID-based lookup (new accounts) ──
          const uidSnap = await getDoc(doc(db, 'userProfiles', user.uid));
          if (uidSnap.exists()) {
            setCurrentUserProfile({ id: uidSnap.id, ...uidSnap.data() });
          } else {
            // ── 2. Fall back to email query (legacy accounts created with addDoc) ──
            const q = query(
              collection(db, 'userProfiles'),
              where('email', '==', user.email)
            );
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              const d = qSnap.docs[0];
              setCurrentUserProfile({ id: d.id, ...d.data() });
            } else {
              // No profile found at all — minimal access
              setCurrentUserProfile({ email: user.email, role: 'user' });
            }
          }
        } catch {
          setCurrentUserProfile({ email: user.email, role: 'user' });
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setCurrentUserProfile(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login  = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return { currentUser, currentUserProfile, isLoading, login, logout };
};
