// Migration helper: rename users in Firestore doc 'jar/data' and in localStorage (jar.localdata)
// Usage: open your app (docs/index.html) in a browser where firebase-config.js is loaded.
// In the console paste this file's contents, then run:
// migrateNames({ alice: 'travis', bob: 'david' });
// It will attempt to sign in anonymously (if auth available), then fetch the doc, rename keys,
// and write the updated doc back. It will also update localStorage if present.

async function migrateNames(map){
  if(!window.FIREBASE_CONFIG){
    console.warn('No FIREBASE_CONFIG detected. This will only update localStorage if present.');
  }

  // update localStorage first
  try{
    const key = 'jar.localdata';
    const raw = localStorage.getItem(key);
    if(raw){
      const obj = JSON.parse(raw);
      if(obj.entries){
        const newEntries = {};
        for(const [date, users] of Object.entries(obj.entries)){
          const newUsers = {};
          for(const [u, s] of Object.entries(users)){
            const nu = map[u] || u;
            newUsers[nu] = s;
          }
          newEntries[date] = newUsers;
        }
        obj.entries = newEntries;
        if(Array.isArray(obj.users)){
          obj.users = obj.users.map(u => map[u] || u);
        }
        localStorage.setItem(key, JSON.stringify(obj));
        console.log('Updated localStorage', key);
      }
    } else {
      console.log('No localStorage entry', 'jar.localdata');
    }
  }catch(e){ console.error('localStorage update failed', e); }

  if(!window.FIREBASE_CONFIG) return;

  if(!firebase || !firebase.firestore) {
    console.error('Firebase SDK not loaded on this page. Make sure index.html includes Firebase.');
    return;
  }

  try{
    if(firebase.auth){
      try{ await firebase.auth().signInAnonymously(); console.log('Signed in anonymously'); }catch(e){ console.warn('Anonymous sign-in failed', e); }
    }

    const db = firebase.firestore();
    const docRef = db.collection('jar').doc('data');
    const snap = await docRef.get();
    if(!snap.exists){
      console.warn('Document jar/data does not exist. Nothing to migrate.');
      return;
    }
    const data = snap.data();
    const entries = data.entries || {};
    const users = Array.isArray(data.users) ? data.users.slice() : [];

    // rename users in users list
    const newUsers = users.map(u => map[u] || u);

    const newEntries = {};
    for(const [date, userMap] of Object.entries(entries)){
      const newUserMap = {};
      for(const [u, status] of Object.entries(userMap)){
        const nu = map[u] || u;
        newUserMap[nu] = status;
      }
      newEntries[date] = newUserMap;
    }

    const newDoc = { users: newUsers, entries: newEntries };
    await docRef.set(newDoc, { merge: false });
    console.log('Firestore document jar/data updated successfully');
  }catch(e){
    console.error('Firestore migration failed', e);
  }
}

// Expose to window for convenience
window.migrateNames = migrateNames;
