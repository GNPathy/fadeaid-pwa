const DB_NAME = 'fadeaid-db', DB_VER = 1;
let _db;
async function getDB() {
  if (_db) return _db;
  _db = await idb.openDB(DB_NAME, DB_VER, {
    upgrade(db) {
      const p = db.createObjectStore('studentProfiles', {keyPath:'id',autoIncrement:true});
      p.createIndex('nameSubject', ['name','subject']);
      const s = db.createObjectStore('sessions', {keyPath:'id',autoIncrement:true});
      s.createIndex('startTime','startTime');
      const ev = db.createObjectStore('trackingEvents', {keyPath:'id',autoIncrement:true});
      ev.createIndex('sessionId','sessionId');
    }
  });
  return _db;
}
async function db_getProfiles() { return (await getDB()).getAll('studentProfiles'); }
async function db_getProfile(id) { return (await getDB()).get('studentProfiles', id); }
async function db_saveProfile(p) {
  const db = await getDB();
  if (p.id) return db.put('studentProfiles', p);
  const c = {...p}; delete c.id; return db.add('studentProfiles', c);
}
async function db_deleteProfile(id) { return (await getDB()).delete('studentProfiles', id); }
async function db_createSession(s) {
  const db = await getDB(); const c = {...s}; delete c.id; return db.add('sessions', c);
}
async function db_updateSession(s) { return (await getDB()).put('sessions', s); }
async function db_getSession(id) { return (await getDB()).get('sessions', id); }
async function db_getAllSessions() {
  const all = await (await getDB()).getAll('sessions');
  return all.sort((a,b) => b.startTime - a.startTime);
}
async function db_addEvent(e) {
  const db = await getDB(); const c = {...e}; delete c.id; return db.add('trackingEvents', c);
}
async function db_getEventsForSession(sid) {
  return (await getDB()).transaction('trackingEvents').store
    .index('sessionId').getAll(IDBKeyRange.only(sid));
}
async function db_deleteEvent(id) { return (await getDB()).delete('trackingEvents', id); }
async function db_getAllEvents() { return (await getDB()).getAll('trackingEvents'); }
