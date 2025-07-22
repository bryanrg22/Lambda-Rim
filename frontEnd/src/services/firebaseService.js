import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  increment,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where,
} from "firebase/firestore"
import { db, auth, googleProvider, microsoftProvider } from "../firebase"
import { createUserWithEmailAndPassword,
        linkWithPopup,
        signInWithEmailAndPassword,
        linkWithCredential,
        EmailAuthProvider,
        fetchSignInMethodsForEmail,
        signInWithPopup,
        OAuthProvider,
        sendEmailVerification,
        signOut,
} from "firebase/auth";

const DEFAULT_PFP = "/default_pfp.jpg";
const safeAvatar = (url) => (url && url.trim() !== "" ? url : DEFAULT_PFP);

// ===== HELPER FUNCTIONS FOR DOCUMENT REFERENCES =====
// Convert any flavour of gameDate into YYYYMMDD for IDs
const getDateSuffix = (pd) => {
  const raw = pd?.gameDate
  let d
  if (!raw) return null
  if (typeof raw?.toDate === "function")
    d = raw.toDate() // Firestore Timestamp
  else if (raw instanceof Date) d = raw
  else d = new Date(raw) // 'YYYY‑MM‑DD' | 'MM/DD/YYYY'
  return isNaN(d) ? null : d.toISOString().slice(0, 10).replace(/-/g, "")
}

/**
 * Resolve a single document reference to full data
 */
const resolveDocumentReference = async (docRef) => {
  try {
    let actualRef = docRef

    if (typeof docRef === "string") {
      // Remove leading slash if present and convert to DocumentReference
      const cleanPath = docRef.startsWith("/") ? docRef.substring(1) : docRef
      actualRef = doc(db, cleanPath)
    } else if (!docRef || (!docRef.firestore && typeof docRef.get !== "function")) {
      console.warn("Invalid document reference:", docRef)
      return null
    }

    console.log("Resolving document reference:", actualRef.path)
    const docSnap = await getDoc(actualRef)

    if (docSnap.exists()) {
      const data = {
        id: docSnap.id,
        ...docSnap.data(),
      }
      console.log("Successfully resolved document:", actualRef.path, data)
      return data
    } else {
      console.warn("Document not found:", actualRef.path)
      return null
    }
  } catch (error) {
    console.error("Error resolving document reference:", error)
    return null
  }
}

/**
 * Resolve multiple document references in batch for efficiency
 */
const resolveDocumentReferences = async (docRefs) => {
  if (!docRefs || !Array.isArray(docRefs) || docRefs.length === 0) {
    console.log("No document references to resolve")
    return []
  }

  try {
    console.log("Resolving", docRefs.length, "document references")

    // Convert all references to DocumentReference objects
    const validRefs = docRefs
      .map((ref) => {
        if (typeof ref === "string") {
          return doc(db, ref)
        } else if (ref && (ref.firestore || typeof ref.get === "function")) {
          // Check for Firestore DocumentReference objects
          return ref
        } else {
          console.warn("Invalid reference:", ref)
          return null
        }
      })
      .filter(Boolean)

    if (validRefs.length === 0) {
      console.warn("No valid document references found")
      return []
    }

    // Batch fetch all documents
    const promises = validRefs.map((ref) => getDoc(ref))
    const snapshots = await Promise.all(promises)

    // Convert snapshots to data objects
    const resolvedData = snapshots
      .map((snap, index) => {
        if (snap.exists()) {
          const data = {
            id: snap.id,
            ...snap.data(),
          }
          console.log("Resolved document:", validRefs[index].path)
          return data
        } else {
          console.warn("Document not found:", validRefs[index].path)
          return null
        }
      })
      .filter(Boolean) // Remove null entries

    console.log("Successfully resolved", resolvedData.length, "out of", docRefs.length, "documents")
    return resolvedData
  } catch (error) {
    console.error("Error resolving document references:", error)
    return []
  }
}

export const getUserPicks = async (username) => {
  try {
    console.log("Getting picks for user:", username)
    const userRef = doc(db, "users", username)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      console.log("User document not found:", username)
      return []
    }

    const userData = userSnap.data()
    const picks = userData.picks || []

    console.log("Raw picks from database:", picks)

    if (picks.length === 0) {
      console.log("No picks found for user")
      return []
    }

    // Check if picks are document references or full objects
    const firstPick = picks[0]

    // If it's a DocumentReference object or a path string
    if (typeof firstPick === "string" || (firstPick && (firstPick.firestore || typeof firstPick.get === "function"))) {
      console.log("Document references detected, resolving...")
      const resolvedPicks = await resolveDocumentReferences(picks)

      if (resolvedPicks.length === 0) {
        console.warn("No picks could be resolved from references")
        return []
      }

      return transformPicksData(resolvedPicks)
    }

    // If picks are already full objects (legacy)
    if (firstPick && typeof firstPick === "object" && firstPick.name) {
      console.log("Legacy picks detected, returning as-is")
      return transformPicksData(picks)
    }

    console.warn("Unknown picks format:", picks)
    return []
  } catch (error) {
    console.error("Error getting user picks:", error)
    return []
  }
}

// Helper function to transform picks data
const transformPicksData = (picks) => {
  return picks
    .map((pick) => {
      if (!pick) return null

      // Extract threshold from the document ID if not present
      let threshold = pick.threshold
      if (!threshold && pick.id) {
        const parts = pick.id.split("_")
        const thresholdPart = parts.find((part) => !isNaN(Number.parseFloat(part)))
        if (thresholdPart) {
          threshold = Number.parseFloat(thresholdPart)
        }
      }

      return {
        id: pick.id,
        player: pick.name || pick.playerName || "Unknown Player",
        name: pick.name || pick.playerName || "Unknown Player",
        playerId: pick.playerId,
        team: pick.team || "Unknown Team",
        opponent: pick.opponent || "Unknown Opponent",
        threshold: threshold || 0,
        photoUrl: pick.photoUrl || "/placeholder.svg?height=100&width=100",
        teamLogo: pick.teamLogo || "/placeholder.svg?height=40&width=40",
        opponentLogo: pick.opponentLogo || "/placeholder.svg?height=40&width=40",
        gameDate: pick.gameDate
          ? pick.gameDate.toDate
            ? pick.gameDate.toDate().toLocaleDateString()
            : pick.gameDate
          : "TBD",
        gameTime: pick.gameTime || "TBD",
        recommendation: pick.betExplanation?.recommendation || "OVER",
        position: pick.position,
        // Include all original data for other components that might need it
        ...pick,
      }
    })
    .filter(Boolean)
}

/**
 * Create document reference from player data
 */
const createPlayerDocumentReference = (playerData, isActive = true) => {
  const collection = isActive ? "active" : "concluded"

  // Better ID generation with multiple fallbacks
  let playerId = playerData.id || playerData.playerId

  if (!playerId) {
    // Generate ID from player name and threshold
    const playerName = playerData.playerName || playerData.name || playerData.player
    const threshold = playerData.threshold

    if (playerName && threshold !== undefined) {
      const datePart = getDateSuffix(playerData)
      playerId = `${playerName.toLowerCase().replace(/\s+/g, "_")}_${threshold}` + (datePart ? `_${datePart}` : "")
    } else {
      console.error("Cannot create document reference - missing player name or threshold:", playerData)
      throw new Error(`Invalid player data for document reference: missing name or threshold`)
    }
  }

  console.log("Creating document reference with ID:", playerId, "for collection:", collection)
  return doc(db, "processedPlayers", "players", collection, playerId)
}

/**
 * Get document reference path for migration
 */
const getDocumentReferencePath = (playerData, isActive = true) => {
  const collection = isActive ? "active" : "concluded"
  const playerName = playerData.playerName || playerData.name || playerData.player
  const threshold = playerData.threshold
  const datePart = getDateSuffix(playerData)
  const playerId = `${playerName.toLowerCase().replace(/\s+/g, "_")}_${threshold}${datePart ? "_" + datePart : ""}`

  return `processedPlayers/players/${collection}/${playerId}`
}


/* ---------- FEDERATED‑AUTH HELPERS ---------- */
// 🔎 quick map: auth UID  ➜  your userId (username)
export const getUserIdForAuthUid = async (uid) => {
  const snap = await getDoc(doc(db, "authMap", uid));
  return snap.exists() ? snap.data().userId : null;
};

// ↔️ write/refresh the mapping & profile provider blob
export const linkAuthUidToUser = async (uid, userId, providerKey, authUser) => {
  const avatar = safeAvatar(authUser.photoURL);

  await setDoc(doc(db, "authMap", uid), { userId, provider: providerKey }, { merge: true });

  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    [`profile.authProviders.${providerKey}`]: {
      uid,
      email: authUser.email,
      displayName: authUser.displayName,
      photoURL: avatar,
      linkedAt: serverTimestamp(),
    },
    "profile.email":        authUser.email,
    "profile.displayName":  authUser.displayName,
    "profile.photoURL":     avatar,
    "profile.pfp":          avatar,
    "profile.lastLogin":    serverTimestamp(),
  });
};

// 🔑 main entry: call after ANY Firebase‑Auth sign‑in
/**
 * Ensure a Firestore profile exists & is updated for a Firebase Auth user.
 * @param {FirebaseUser} authUser
 * @param {string} providerKey  e.g. "google" | "microsoft" | "password"
 * @param {object} [opts]
 * @param {string} [opts.desiredUsername]  preferred handle to use if creating a brand-new doc
 */
export const upsertUserFromAuthUser = async (authUser, providerKey = "google", opts = {}) => {
  // 1) direct map
  let userId = await getUserIdForAuthUid(authUser.uid);
  if (userId) {
    const avatar = safeAvatar(authUser.photoURL);
    await updateDoc(doc(db, "users", userId), {
      "profile.lastLogin": serverTimestamp(),
      "profile.photoURL":  avatar,
      "profile.pfp": avatar,
    });
    return userId;
  }

  // 2) try e‑mail match against legacy docs
  const email = authUser.email?.toLowerCase();
  let legacyDoc = null;
  if (email) {
    const q = query(collection(db, "users"), where("profile.email", "==", email));
    const snap = await getDocs(q);
    if (!snap.empty) legacyDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  if (legacyDoc) {
    userId = legacyDoc.id; // keep their old username as canonical
  } else {
    // 3) brand new → choose username
    const base =
      opts.desiredUsername?.trim() ||
      (email ? email.split("@")[0] : authUser.displayName?.replace(/\s+/g, "").toLowerCase()) ||
      `user_${Date.now()}`;
    let candidate = base;
    let i = 0;
    while ((await getDoc(doc(db, "users", candidate))).exists()) candidate = `${base}${++i}`;
    userId = candidate;
    await initializeUser(userId, null); // seeds profile (password null OK)
  }

  // 4) finally link uid→userId and touch lastLogin
  await linkAuthUidToUser(authUser.uid, userId, providerKey, authUser);
  return userId;
};


/* ---------- EMAIL / PASSWORD AUTH HELPERS ---------- */

/**
 * Create a Firebase Auth user (email/password) and seed Firestore profile.
 * desiredUsername: if omitted, we'll derive from email local-part.
 */
export const emailSignUp = async (email, password) => {
  const emailNorm = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, emailNorm, password);

  await upsertUserFromAuthUser(cred.user, "password"); // create Firestore profile

  /* 🚀 send verification, then log them out until they confirm */
  await sendEmailVerification(cred.user);
  await signOut(auth);

  const userId = await getUserIdForAuthUid(cred.user.uid);
  return { user: cred.user, verificationSent: true, userId };
};

/**
 * Sign in an existing Firebase Auth email/password user.
 * (If this user doesn't have a Firestore profile yet, we'll create it.)
 */
export const emailSignIn = async (email, password) => {
  const emailNorm = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, emailNorm, password);
  if (!cred.user.emailVerified) {
     // immediately sign out to avoid issuing a session
    await signOut(auth);
    const err = new Error("unverified");
    err.code = "auth/email-not-verified";
    throw err;
  }

  const userId = await upsertUserFromAuthUser(cred.user, "password");
  return { user: cred.user, userId };
};


/**
 * Sign in with a provider and, if the e‑mail already exists under a different
 * credential, automatically link them (“Pattern A”).
 *
 * Works even if auth.currentUser is already logged in.
 *
 * @param {AuthProvider} provider       e.g. googleProvider
 * @param {string}       providerKey    "google" | "microsoft" | "apple"
 * @param {Function?}    promptForPw    async (email) => stringPassword
 * @returns {string} userId             Firestore userId
 */
export const signInWithProviderAndLink = async (provider, providerKey, promptForPw) => {
  // 🚩 Case 0: user is already signed‑in → link directly.
  if (auth.currentUser) {
    if (window.confirm(`Link ${providerKey} to your account ${auth.currentUser.email}?`)) {
        try {
          await linkWithPopup(auth.currentUser, provider);
        } catch (err) {
          if (err.code !== "auth/credential-already-in-use") throw err;
        }
        return await upsertUserFromAuthUser(auth.currentUser, providerKey);
      } else {
        throw new Error("link-cancelled");
      }
  }

  /* --------------- Normal sign‑in flow --------------- */
  try {
    const cred  = await signInWithPopup(auth, provider);        // happy path
    return await upsertUserFromAuthUser(cred.user, providerKey);

  } catch (err) {
    if (err.code !== "auth/account-exists-with-different-credential") throw err;

    const pendingCred =
      OAuthProvider.credentialFromError(err) ||
      EmailAuthProvider.credentialFromError?.(err) ||
      null;

    const email = err.customData?.email;
    if (!email) throw err;

    const methods = await fetchSignInMethodsForEmail(auth, email);
    console.log("Collision for", email, "existing methods:", methods);

    let primaryUser;

    if (methods.includes("google.com")) {
      primaryUser = (await signInWithPopup(auth, googleProvider)).user;

    } else if (methods.includes("microsoft.com")) {
      primaryUser = (await signInWithPopup(auth, microsoftProvider)).user;

    } else if (methods.includes("password")) {
      if (!promptForPw) throw new Error("Account uses e‑mail/password; sign in with e‑mail first.");
      const pw       = await promptForPw(email);
      primaryUser    = (await signInWithEmailAndPassword(auth, email, pw)).user;

    } else if (methods.length === 0) {
      // The e‑mail exists in Auth but has *no* providers yet (rare).
     // Treat as brand‑new: sign in with the requested provider ‑‑ no linking needed.
     primaryUser = (await signInWithPopup(auth, provider)).user;
     return await upsertUserFromAuthUser(primaryUser, providerKey);
    }
    
    else {
      throw new Error(
        `Existing provider (${methods.join(",") || "none"}) not supported yet.`
      );
    }

    if (pendingCred) {
      // Link the Microsoft (or Google) credential we originally tried
      const ok = window.confirm(`Link ${providerKey} to your existing account ${primaryUser.email}?`);
      if (!ok) throw new Error("link-cancelled");
      await linkWithCredential(primaryUser, pendingCred);
    }

    return await upsertUserFromAuthUser(primaryUser, providerKey);
  }
};

export const humanMessage = (code) => {
  switch (code) {
    /* sign‑in errors */
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect e‑mail or password.";

    /* sign‑up errors */
    case "auth/email-already-in-use":
      return "That e‑mail is already registered. Use Sign In instead.";

    case "link-cancelled":
      return "Linking cancelled.";

    case "auth/account-exists-with-other-provider":
      return "That e‑mail is linked to a social login. Use Google or Microsoft to sign in.";
        
    /* throttling */
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a bit and try again.";

    default:
      return "Oops – " + code.replace("auth/", "").replace(/-/g, " ");
  }
};


// ===== USER PROFILE FUNCTIONS =====

// Get user profile by username (for sign in)
export const getUserByUsername = async (username) => {
  try {
    const userRef = doc(db, "users", username)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      return {
        id: userSnap.id,
        ...userSnap.data(),
      }
    } else {
      return null
    }
  } catch (error) {
    console.error("Error getting user:", error)
    throw error
  }
}

/**
 * Lightweight existence check used by the Community search bar.
 * Returns true/false – no profile parsing overhead.
 */
export const doesUserExist = async (username) => {
  if (!username) return false;
  const snap = await getDoc(doc(db, "users", username.trim().toLowerCase()));
  return snap.exists();
};


// Verify user password
export const verifyUserPassword = (userData, password) => {
  // Check if the password is in the profile object or at the root level
  return (userData.profile && userData.profile.password === password) || userData.password === password
}

// Check if user has accepted Terms of Service
export const checkTosAcceptance = async (userId) => {
  try {
    const userRef = doc(db, "users", userId)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const userData = userSnap.data()
      const profile = userData.profile || userData
      return !!profile.tosAccepted
    }
    return false
  } catch (error) {
    console.error("Error checking ToS acceptance:", error)
    return false
  }
}

// Accept Terms of Service
export const acceptTermsOfService = async (userId) => {
  try {
    const userRef = doc(db, "users", userId)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const userData = userSnap.data()

      if (userData.profile) {
        // New structure - update profile object
        await updateDoc(userRef, {
          "profile.tosAccepted": serverTimestamp(),
          "profile.lastLogin": serverTimestamp(),
        })
      } else {
        // Old structure - update fields directly
        await updateDoc(userRef, {
          tosAccepted: serverTimestamp(),
          lastLogin: serverTimestamp(),
        })
      }

      console.log("Terms of Service accepted for user:", userId)
      return true
    }
    return false
  } catch (error) {
    console.error("Error accepting ToS:", error)
    throw error
  }
}

// Get user profile
export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, "users", userId)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      // Return the profile object if it exists, otherwise return the data
      return userSnap.data().profile || userSnap.data()
    } else {
      return null
    }
  } catch (error) {
    console.error("Error getting user profile:", error)
    throw error
  }
}

// Update user profile
export const updateUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, "users", userId)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const userData = userSnap.data()

      if (userData.profile) {
        // New structure - update profile object
        const merged = {
          ...userData.profile,
          ...profileData,
          lastLogin: serverTimestamp(),
        }
        await updateDoc(userRef, { profile: merged })
      } else {
        // Old structure - update fields directly
        await updateDoc(userRef, {
          ...profileData,
          lastLogin: serverTimestamp(),
        })
      }
    }
  } catch (error) {
    console.error("Error updating user profile:", error)
    throw error
  }
}

// Update user stats
export const updateUserStats = async (userId, stats) => {
  try {
    const userRef = doc(db, "users", userId)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const userData = userSnap.data()

      if (userData.profile) {
        // New structure
        await updateDoc(userRef, {
          "profile.totalEarnings": increment(stats.earnings || 0),
          "profile.totalBets": increment(stats.bets || 0),
          "profile.winCount": increment(stats.wins || 0),
          "profile.lossCount": increment(stats.losses || 0),
          "profile.winRate": stats.newWinRate || increment(0),
        })
      } else {
        // Old structure
        await updateDoc(userRef, {
          totalEarnings: increment(stats.earnings || 0),
          totalBets: increment(stats.bets || 0),
          winCount: increment(stats.wins || 0),
        })
      }
    }
  } catch (error) {
    console.error("Error updating user stats:", error)
    throw error
  }
}

// ===== PICKS FUNCTIONS WITH DOCUMENT REFERENCES =====

// Add or update a pick using document references
export const addUserPick = async (username, pickData) => {
  if (typeof pickData?.id !== "string") {
    throw new Error("Invalid pickData.id — must be a string")
  }

  try {
    const userRef = doc(db, "users", username)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) return []

    let playerDocRef

    // First, try to use the exact document ID that was passed
    if (pickData.id) {
      playerDocRef = doc(db, "processedPlayers", "players", "active", pickData.id)

      // Check if document exists with the provided ID
      const playerDocSnap = await getDoc(playerDocRef)

      if (playerDocSnap.exists()) {
        console.log("Found document with provided ID:", pickData.id)
      } else {
        console.log("Document not found with provided ID, searching for alternatives...")

        // Search for any document that matches the player and threshold pattern
        const activeRef = collection(db, "processedPlayers", "players", "active")
        const snapshot = await getDocs(activeRef)

        let foundDoc = null
        const playerName = pickData.playerName || pickData.name || pickData.player
        const threshold = pickData.threshold
        const searchPattern = `${playerName.toLowerCase().replace(/\s+/g, "_")}_${threshold}`

        snapshot.forEach((doc) => {
          const docId = doc.id
          if (docId.startsWith(searchPattern)) {
            foundDoc = doc
            playerDocRef = doc.ref
            console.log("Found matching document:", docId)
          }
        })

        if (!foundDoc) {
          throw new Error(
            `Player document not found for: ${playerName} ${threshold}. Available documents may use different naming convention.`,
          )
        }
      }
    } else {
      throw new Error("No document ID provided in pickData")
    }

    // Get existing picks (array of document references)
    const existingPicks = Array.isArray(userSnap.data().picks) ? userSnap.data().picks : []

    // Check if this pick already exists (compare document paths)
    const existingIndex = existingPicks.findIndex((pickRef) => pickRef && pickRef.path === playerDocRef.path)

    let updatedPicks
    if (existingIndex >= 0) {
      // Update existing pick
      updatedPicks = [...existingPicks]
      updatedPicks[existingIndex] = playerDocRef
    } else {
      // Add new pick
      updatedPicks = [...existingPicks, playerDocRef]
    }

    await updateDoc(userRef, { picks: updatedPicks })

    // Return resolved picks for immediate use
    return await resolveDocumentReferences(updatedPicks)
  } catch (error) {
    console.error("Error adding user pick:", error)
    throw error
  }
}

// Remove a pick by document reference path
export const removeUserPick = async (username, pickId) => {
  try {
    const userRef = doc(db, "users", username)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) return []

    const existingPicks = userSnap.data().picks || []

    // Filter out the pick by comparing document paths or IDs
    const updatedPicks = existingPicks.filter((pickRef) => {
      if (!pickRef || (!pickRef.firestore && typeof pickRef.get !== "function")) return false

      // Extract ID from document path for comparison
      const pathParts = pickRef.path.split("/")
      const docId = pathParts[pathParts.length - 1]

      return docId !== pickId
    })

    await updateDoc(userRef, { picks: updatedPicks })

    // Return resolved picks
    return await resolveDocumentReferences(updatedPicks)
  } catch (error) {
    console.error("Error removing user pick:", error)
    throw error
  }
}

// ===== BET FUNCTIONS WITH DOCUMENT REFERENCES =====

// Create a new bet with document references
export const createBet = async (userId, betData) => {
  try {
    console.log("Creating bet with data:", betData)
    const gameDate = betData.gameDate || new Date().toISOString().substring(0, 10)

    // Validate and prepare picks data
    const validatedPicks = betData.picks.map((pick, index) => {
      console.log(`Validating pick ${index}:`, pick)

      // Ensure we have required fields
      const playerName = pick.playerName || pick.name || pick.player
      const threshold = pick.threshold

      if (!playerName) {
        throw new Error(`Pick ${index} is missing player name`)
      }

      if (threshold === undefined || threshold === null) {
        throw new Error(`Pick ${index} is missing threshold`)
      }

      const datePart = getDateSuffix(pick)
      // (optional) only keep this if you need playerId later in this scope
      // const playerId =
      //   `${playerName.toLowerCase().replace(/\s+/g, "_")}_${threshold}` +
      //   (datePart ? `_${datePart}` : "")

      // Create a standardized pick object
      return {
        ...pick,
        playerName: playerName,
        name: playerName,
        player: playerName,
        threshold: Number.parseFloat(threshold),
        id:
          pick.id ||
          pick.playerId ||
          `${playerName.toLowerCase().replace(/\s+/g, "_")}_${threshold}` + (datePart ? `_${datePart}` : ""),
      }
    })

    console.log("Validated picks:", validatedPicks)

    // Generate timestamp-based document ID in YYYYMMDDTHHMMSSZ format
    const now = new Date()
    const betId = now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")

    console.log("Generated bet ID:", betId)

    // Convert picks to document references instead of storing full objects
    const pickReferences = validatedPicks.map((pick) => {
      console.log("Creating reference for pick:", pick)
      return createPlayerDocumentReference(pick, true)
    })

    console.log(
      "Created pick references:",
      pickReferences.map((ref) => ref.path),
    )

    // Create bet document with specific ID and document references
    const betRef = doc(db, "users", userId, "activeBets", betId)
    await setDoc(betRef, {
      betAmount: Number.parseFloat(betData.betAmount),
      betPayOut: Number.parseFloat(betData.betPayOut),
      bettingPlatform: betData.bettingPlatform || "PrizePicks",
      betType: betData.betType || "Power Play",
      picks: pickReferences, // Store document references instead of full objects
      createdAt: serverTimestamp(),
    })

    console.log("Successfully created bet with ID:", betId)
    return betId
  } catch (error) {
    console.error("Error creating bet:", error)
    throw error
  }
}

// Get active bets and resolve document references
export const getActiveBets = async (userId) => {
  try {
    console.log("Getting active bets for user:", userId)
    // Get from new sub-collection
    const snap = await getDocs(collection(db, "users", userId, "activeBets"))

    if (!snap.empty) {
      console.log("Found", snap.docs.length, "active bets")
      const bets = await Promise.all(
        snap.docs.map(async (betDoc) => {
          const betData = betDoc.data()
          console.log("Processing bet:", betDoc.id, "with picks:", betData.picks?.length || 0)

          // Resolve pick references to full data if they are references
          let resolvedPicks = []
          if (betData.picks && Array.isArray(betData.picks)) {
            // Check if picks are document references
            if (
              betData.picks.length > 0 &&
              (betData.picks[0].firestore || typeof betData.picks[0].get === "function")
            ) {
              console.log("Resolving document references for bet", betDoc.id)
              const rawResolvedPicks = await resolveDocumentReferences(betData.picks)

              // Transform the resolved picks to ensure proper field mapping
              resolvedPicks = rawResolvedPicks.map((pick) => ({
                id: pick.id,
                name: pick.name || pick.playerName || "Unknown Player",
                playerName: pick.name || pick.playerName || "Unknown Player",
                player: pick.name || pick.playerName || "Unknown Player",
                team: pick.team || pick.playerTeam || "Unknown Team",
                opponent: pick.opponent || "Unknown Opponent",
                threshold: pick.threshold || 0,
                recommendation: pick.betExplanation?.recommendation || pick.recommendation || "OVER",
                photoUrl: pick.photoUrl || "/placeholder.svg?height=40&width=40",
                gameStatus: pick.gameStatus || "Scheduled",
                status: pick.gameStatus || pick.status || "Scheduled",
                // Include all original data
                ...pick,
              }))
            } else if (
              betData.picks.length > 0 &&
              typeof betData.picks[0] === "object" &&
              betData.picks[0].playerName
            ) {
              // These are full objects (legacy or current format)
              console.log("Using full objects for bet", betDoc.id)
              resolvedPicks = betData.picks.map((pick) => ({
                id: pick.id,
                name: pick.name || pick.playerName || pick.player || "Unknown Player",
                playerName: pick.name || pick.playerName || pick.player || "Unknown Player",
                player: pick.name || pick.playerName || pick.player || "Unknown Player",
                team: pick.team || pick.playerTeam || "Unknown Team",
                opponent: pick.opponent || "Unknown Opponent",
                threshold: pick.threshold || 0,
                recommendation: pick.betExplanation?.recommendation || pick.recommendation || "OVER",
                photoUrl: pick.photoUrl || "/placeholder.svg?height=40&width=40",
                gameStatus: pick.gameStatus || "Scheduled",
                status: pick.gameStatus || pick.status || "Scheduled",
                // Include all original data
                ...pick,
              }))
            }
          }

          console.log("Resolved", resolvedPicks.length, "picks for bet", betDoc.id)
          console.log("Sample resolved pick:", resolvedPicks[0])

          return {
            id: betDoc.id,
            ...betData,
            picks: resolvedPicks,
          }
        }),
      )

      console.log("Returning", bets.length, "formatted active bets")
      return bets
    }

    console.log("No active bets found in sub-collection, checking legacy structure")
    // Fallback to old array structure
    const userSnap = await getDoc(doc(db, "users", userId))
    if (!userSnap.exists()) {
      console.log("User document not found")
      return []
    }

    const legacyBets = (userSnap.data().bets || []).filter((b) => b.status === "Active")
    console.log("Found", legacyBets.length, "legacy active bets")
    return legacyBets
  } catch (error) {
    console.error("Error getting active bets:", error)
    return []
  }
}

// Get bet history and resolve document references
export const getBetHistory = async (userId) => {
  try {
    const histRef = collection(db, "users", userId, "betHistory")
    const snap = await getDocs(query(histRef, orderBy("createdAt", "desc")))

    const bets = await Promise.all(
      snap.docs.map(async (betDoc) => {
        const betData = betDoc.data()

        // Resolve pick references to full data (from concluded collection)
        let resolvedPicks = []
        if (betData.picks && Array.isArray(betData.picks)) {
          // Check if picks are references or full objects
          if (betData.picks.length > 0 && (betData.picks[0].firestore || typeof betData.picks[0].get === "function")) {
            // These are document references, resolve them
            resolvedPicks = await resolveDocumentReferences(betData.picks)
          } else {
            // These are already full objects (legacy)
            resolvedPicks = betData.picks
          }
        }

        return {
          id: betDoc.id,
          ...betData,
          picks: resolvedPicks,
        }
      }),
    )

    bets.sort((a, b) => {
      const aTime = a.createdAt?.seconds
        ? a.createdAt.seconds
        : Date.parse(a.createdAt || 0) / 1000
      const bTime = b.createdAt?.seconds
        ? b.createdAt.seconds
        : Date.parse(b.createdAt || 0) / 1000
      return bTime - aTime
    })

    return bets
  } catch (error) {
    console.error("Error getting bet history:", error)
    return []
  }
}

// Get all bet history (simplified for now)
export const getAllBetHistory = async (userId) => {
  try {
    return await getBetHistory(userId)
  } catch (error) {
    console.error("Error getting all bet history:", error)
    return []
  }
}

/**
 * Stub for moving completed bets client-side.
 * Your Cloud Function does the real archiving,
 * so here we just return zero moved.
 */
export const moveCompletedBets = async (userId) => {
  return { moved: 0 }
}

// Get user's active bets (legacy)
export const getUserActiveBets = async (username) => {
  return await getActiveBets(username)
}

// Cancel one or all active bets - ONLY DELETE, DO NOT CREATE HISTORY
export const cancelActiveBet = async (userId, betId) => {
  try {
    console.log(`🚫 CANCELING BET: ${betId} for user: ${userId}`)
    console.log("⚠️  This should ONLY delete from activeBets, NO betHistory creation")

    // 1) Delete from subcollection - this is the ONLY action for cancellation
    if (betId) {
      const betRef = doc(db, "users", userId, "activeBets", betId)
      console.log(`Deleting bet document: ${betRef.path}`)
      await deleteDoc(betRef)
      console.log(`✅ Successfully deleted bet ${betId} from activeBets`)
    } else {
      // Cancel all active bets
      const activeBets = await getActiveBets(userId)
      console.log(`Deleting ${activeBets.length} active bets`)
      await Promise.all(
        activeBets.map((b) => {
          const betRef = doc(db, "users", userId, "activeBets", b.id)
          console.log(`Deleting bet document: ${betRef.path}`)
          return deleteDoc(betRef)
        }),
      )
      console.log(`✅ Successfully deleted all ${activeBets.length} active bets`)
    }

    // 2) Legacy fallback: remove from users/{userId}.bets[] array if it exists
    const userRef = doc(db, "users", userId)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      const legacy = userSnap.data().bets || []
      const filtered = legacy.filter((b) => (betId ? b.id !== betId : b.status !== "Active"))
      if (filtered.length !== legacy.length) {
        await updateDoc(userRef, { bets: filtered })
        console.log("✅ Updated legacy bets array")
      }
    }

    console.log("🎉 Bet cancellation completed - NO betHistory should be created")
    return true
  } catch (err) {
    console.error("❌ cancelActiveBet failed:", err)
    throw err
  }
}

// Update a single active bet
export const updateActiveBet = async (userId, betId, updatedData) => {
  const userRef = doc(db, "users", userId)

  try {
    // If updating picks, convert to document references
    if (updatedData.picks) {
      updatedData.picks = updatedData.picks.map((pick) => createPlayerDocumentReference(pick, true))
    }

    // 1) sub‐collection update
    const betRef = doc(db, "users", userId, "activeBets", betId)
    await updateDoc(betRef, updatedData)

    // 2) legacy fallback: patch users/{userId}.bets[]
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      const legacy = userSnap.data().bets || []
      const patched = legacy.map((b) => (b.id === betId ? { ...b, ...updatedData } : b))
      await updateDoc(userRef, { bets: patched })
    }

    return true
  } catch (err) {
    console.error("updateActiveBet failed:", err)
    throw err
  }
}

// ===== PROCESSED PLAYERS FUNCTIONS =====

// list all active players
export const getProcessedPlayers = async () => {
  try {
    const activeRef = collection(db, "processedPlayers", "players", "active")
    const snaps = await getDocs(activeRef)
    return snaps.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }))
  } catch (error) {
    console.error("Error getting processed players:", error)
    return []
  }
}

// get one by key ("first_last_threshold")
export const getProcessedPlayer = async (playerName, threshold, gameDate = null) => {
  try {
    const key = playerName.toLowerCase().replace(/\s+/g, "_")

    // If gameDate is provided, use it; otherwise try to get current date
    let datePart = null
    if (gameDate) {
      datePart = getDateSuffix({ gameDate })
    } else {
      // Try without date first (legacy support)
      const legacyRef = doc(db, "processedPlayers", "players", "active", `${key}_${threshold}`)
      const legacySnap = await getDoc(legacyRef)
      if (legacySnap.exists()) {
        return legacySnap.data()
      }

      // If legacy doesn't exist, try with today's date
      const today = new Date()
      datePart = getDateSuffix({ gameDate: today })
    }

    const playerId = `${key}_${threshold}${datePart ? "_" + datePart : ""}`
    const ref = doc(db, "processedPlayers", "players", "active", playerId)
    const snap = await getDoc(ref)
    return snap.exists() ? snap.data() : null
  } catch (error) {
    console.error("Error getting processed player:", error)
    return null
  }
}

// Clear out the old picks[] array on the user doc
export const clearUserPicks = async (userId) => {
  try {
    const userRef = doc(db, "users", userId)
    // remove any legacy picks[]
    await updateDoc(userRef, { picks: [] })
    return true
  } catch (error) {
    console.error("Error clearing user picks:", error)
    throw error
  }
}

// ===== MIGRATION FUNCTIONS =====

/**
 * Migrate user picks from full objects to document references
 */
export const migrateUserPicksToReferences = async (userId) => {
  try {
    const userRef = doc(db, "users", userId)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      console.log(`User ${userId} not found`)
      return { success: false, message: "User not found" }
    }

    const userData = userSnap.data()
    const picks = userData.picks || []

    if (picks.length === 0) {
      console.log(`No picks to migrate for user ${userId}`)
      return { success: true, message: "No picks to migrate" }
    }

    // Check if picks are already references
    if (picks.length > 0 && (picks[0].firestore || typeof picks[0].get === "function")) {
      console.log(`Picks already migrated for user ${userId}`)
      return { success: true, message: "Picks already migrated" }
    }

    // Convert full objects to document references
    const pickReferences = picks.map((pick) => {
      return createPlayerDocumentReference(pick, true)
    })

    // Update user document with references
    await updateDoc(userRef, { picks: pickReferences })

    console.log(`Successfully migrated ${picks.length} picks for user ${userId}`)
    return {
      success: true,
      message: `Migrated ${picks.length} picks to document references`,
    }
  } catch (error) {
    console.error(`Error migrating picks for user ${userId}:`, error)
    return { success: false, message: error.message }
  }
}

/**
 * Migrate active bets from full objects to document references
 */
export const migrateActiveBetsToReferences = async (userId) => {
  try {
    const activeBetsRef = collection(db, "users", userId, "activeBets")
    const snap = await getDocs(activeBetsRef)

    if (snap.empty) {
      console.log(`No active bets to migrate for user ${userId}`)
      return { success: true, message: "No active bets to migrate" }
    }

    const batch = writeBatch(db)
    let migratedCount = 0

    for (const betDoc of snap.docs) {
      const betData = betDoc.data()
      const picks = betData.picks || []

      if (picks.length === 0) continue

      // Check if picks are already references
      if (picks[0].firestore || typeof picks[0].get === "function") {
        console.log(`Bet ${betDoc.id} already migrated`)
        continue
      }

      // Convert picks to document references
      const pickReferences = picks.map((pick) => {
        return createPlayerDocumentReference(pick, true)
      })

      // Update bet document
      batch.update(betDoc.ref, { picks: pickReferences })
      migratedCount++
    }

    if (migratedCount > 0) {
      await batch.commit()
    }

    console.log(`Successfully migrated ${migratedCount} active bets for user ${userId}`)
    return {
      success: true,
      message: `Migrated ${migratedCount} active bets to document references`,
    }
  } catch (error) {
    console.error(`Error migrating active bets for user ${userId}:`, error)
    return { success: false, message: error.message }
  }
}

/**
 * Migrate bet history from full objects to document references
 */
export const migrateBetHistoryToReferences = async (userId) => {
  try {
    // For now, just migrate current month's history
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = String(now.getMonth() + 1).padStart(2, "0")

    const historyRef = collection(db, "users", userId, "betHistory", year, month)
    const snap = await getDocs(historyRef)

    if (snap.empty) {
      console.log(`No bet history to migrate for user ${userId}`)
      return { success: true, message: "No bet history to migrate" }
    }

    const batch = writeBatch(db)
    let migratedCount = 0

    for (const betDoc of snap.docs) {
      const betData = betDoc.data()
      const picks = betData.picks || []

      if (picks.length === 0) continue

      // Check if picks are already references
      if (picks[0].firestore || typeof picks[0].get === "function") {
        console.log(`History bet ${betDoc.id} already migrated`)
        continue
      }

      // Convert picks to document references (concluded collection)
      const pickReferences = picks.map((pick) => {
        return createPlayerDocumentReference(pick, false) // false = concluded
      })

      // Update bet document
      batch.update(betDoc.ref, { picks: pickReferences })
      migratedCount++
    }

    if (migratedCount > 0) {
      await batch.commit()
    }

    console.log(`Successfully migrated ${migratedCount} history bets for user ${userId}`)
    return {
      success: true,
      message: `Migrated ${migratedCount} history bets to document references`,
    }
  } catch (error) {
    console.error(`Error migrating bet history for user ${userId}:`, error)
    return { success: false, message: error.message }
  }
}

/**
 * Migrate all user data to document references
 */
export const migrateUserToReferences = async (userId) => {
  try {
    console.log(`Starting migration for user ${userId}`)

    const results = {
      picks: await migrateUserPicksToReferences(userId),
      activeBets: await migrateActiveBetsToReferences(userId),
      betHistory: await migrateBetHistoryToReferences(userId),
    }

    const allSuccessful = Object.values(results).every((result) => result.success)

    return {
      success: allSuccessful,
      results,
    }
  } catch (error) {
    console.error(`Error migrating user ${userId}:`, error)
    return { success: false, message: error.message }
  }
}

// Initialize database with basic structure (run once)
export const initializeDatabase = async (userId) => {
  try {
    // Check if user already exists
    const userRef = doc(db, "users", userId)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      // Initialize user profile
      await setDoc(userRef, {
        profile: {
          username: userId,
          email: `${userId}@example.com`,
          displayName: userId,
          pfp: DEFAULT_PFP,
          photoURL: DEFAULT_PFP,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          totalEarnings: 0,
          totalBets: 0,
          winCount: 0,
          lossCount: 0,
          winRate: 0,
          tosAccepted: null, // Add ToS acceptance field
        },
        picks: [], // Initialize as empty array for document references
      })

      console.log("User initialized successfully")
    } else {
      // Check if user has profile object
      const userData = userSnap.data()
      if (!userData.profile) {
        // Migrate user to new structure
        const profile = {
          username: userId,
          password: userData.password,
          email: `${userId}@example.com`,
          displayName: userData.displayName || userId,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          totalEarnings: userData.totalEarnings || 0,
          totalBets: userData.totalBets || 0,
          winCount: userData.winCount || 0,
          lossCount: userData.totalBets ? userData.totalBets - userData.winCount : 0,
          winRate: userData.totalBets && userData.winCount ? (userData.winCount / userData.totalBets) * 100 : 0,
          tosAccepted: userData.tosAccepted || null, // Migrate existing ToS acceptance
        }

        await updateDoc(userRef, { profile })
        console.log("User migrated to new structure")
      } else if (!userData.profile.hasOwnProperty("tosAccepted")) {
        // Add ToS field to existing profile
        await updateDoc(userRef, {
          "profile.tosAccepted": null,
        })
        console.log("Added ToS field to existing user profile")
      }

      // Migrate to document references if needed
      await migrateUserToReferences(userId)
    }
  } catch (error) {
    console.error("Error initializing user:", error)
  }
}

// Initialize user if needed
export const initializeUser = async (username, password) => {
  try {
    const userRef = doc(db, "users", username)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      // Create new user with new structure
      await setDoc(userRef, {
        profile: {
          username: username,
          password: password,
          email: `${username}@example.com`,
          displayName: username,
          pfp: DEFAULT_PFP,
          photoURL: DEFAULT_PFP,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          totalEarnings: 0,
          totalBets: 0,
          winCount: 0,
          lossCount: 0,
          winRate: 0,
          tosAccepted: null, // Add ToS acceptance field
        },
        picks: [], // Initialize as empty array for document references
        bets: [],
      })

    } else {
      // Check if user has profile object
      const userData = userSnap.data()
      if (!userData.profile) {
        // Migrate user to new structure
        const profile = {
          username: username,
          password: password,
          email: `${username}@example.com`,
          displayName: userData.displayName || username,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          totalEarnings: userData.totalEarnings || 0,
          totalBets: userData.totalBets || 0,
          winCount: userData.winCount || 0,
          lossCount: userData.totalBets ? userData.totalBets - userData.winCount : 0,
          winRate: userData.totalBets && userData.winCount ? (userData.winCount / userData.totalBets) * 100 : 0,
          tosAccepted: userData.tosAccepted || null, // Migrate existing ToS acceptance
        }

        await updateDoc(userRef, { profile })
      } else if (!userData.profile.hasOwnProperty("tosAccepted")) {
        // Add ToS field to existing profile
        await updateDoc(userRef, {
          "profile.tosAccepted": null,
        })
        console.log("Added ToS field to existing user profile")
      }

      // Migrate to document references if needed
      await migrateUserToReferences(username)
    }
  } catch (error) {
    console.error("Error initializing user:", error)
    throw error
  }
}

// ===== ADMIN FUNCTIONS =====

// Get admin credentials
export const getAdminCredentials = async () => {
  try {
    const adminRef = doc(db, "admin", "profile")
    const adminSnap = await getDoc(adminRef)

    if (adminSnap.exists()) {
      return adminSnap.data()
    } else {
      // Initialize admin profile if it doesn't exist
      const defaultAdmin = {
        username: "admin",
        password: "ramirez22",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      }
      await setDoc(adminRef, defaultAdmin)
      return defaultAdmin
    }
  } catch (error) {
    console.error("Error getting admin credentials:", error)
    throw error
  }
}

// Verify admin password
export const verifyAdminPassword = (adminData, username, password) => {
  return adminData.username === username && adminData.password === password
}

// Get system overview data
export const getSystemOverview = async () => {
  try {
    const response = await fetch("/api/admin/overview")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    if (data.status === "error") {
      throw new Error(data.error)
    }

    return data
  } catch (error) {
    console.error("Error getting system overview:", error)
    throw error
  }
}

export const getUserAnalytics = async (timeRange = "7d") => {
  try {
    const response = await fetch(`/api/admin/users?timeRange=${timeRange}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    if (data.status === "error") {
      throw new Error(data.error)
    }

    return data
  } catch (error) {
    console.error("Error getting user analytics:", error)
    throw error
  }
}

export const getBetPerformance = async (timeRange = "30d") => {
  try {
    const response = await fetch(`/api/admin/bets?timeRange=${timeRange}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    if (data.status === "error") {
      throw new Error(data.error)
    }

    return data
  } catch (error) {
    console.error("Error getting bet performance:", error)
    throw error
  }
}

export const getPlayerAnalytics = async () => {
  try {
    const response = await fetch("/api/admin/players")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    if (data.status === "error") {
      throw new Error(data.error)
    }

    return data
  } catch (error) {
    console.error("Error getting player analytics:", error)
    throw error
  }
}

export const getFinancialMetrics = async (timeRange = "30d") => {
  try {
    const response = await fetch(`/api/admin/financial?timeRange=${timeRange}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    if (data.status === "error") {
      throw new Error(data.error)
    }

    return data
  } catch (error) {
    console.error("Error getting financial metrics:", error)
    throw error
  }
}

export const getSystemHealth = async () => {
  try {
    const response = await fetch("/api/admin/system")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    if (data.status === "error") {
      throw new Error(data.error)
    }

    return data
  } catch (error) {
    console.error("Error getting system health:", error)
    throw error
  }
}

export const getSystemLogs = async () => {
  try {
    const response = await fetch("/api/admin/logs")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    if (data.status === "error") {
      throw new Error(data.error)
    }

    return data
  } catch (error) {
    console.error("Error getting system logs:", error)
    throw error
  }
}
