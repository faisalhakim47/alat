var PouchDB = require('pouchdb-core')
var IDBPouch = require('pouchdb-adapter-idb')
var HttpPouch = require('pouchdb-adapter-http')
var replication = require('pouchdb-replication')
var merge = require('lodash.merge')
var get = require('lodash.get')

PouchDB
  .plugin(IDBPouch)
  .plugin(HttpPouch)
  .plugin(replication)

var DBs = {}
var autoIncreaseCount = new PouchDB(`auto_increases`)

function db(dbname) {
  if (!dbname) throw new Error('dbname must be defined')
  if (DBs[dbname]) return DBs[dbname]
  throw new Error('Database have not been created yet.')
}

function CreateDatabase(dbname, conf) {
  DBs[dbname] = new PouchDB(dbname)

  if (conf.coucbdb) {
    DBs[dbname].remote = new PouchDB(conf.coucbdb.url + dbname, {
      auth: conf.coucbdb.auth
    })
    autoIncreaseCount = new PouchDB(conf.coucbdb.url + 'auto_increases')
  }

  DBs[dbname].getAll = function getAll() {
    return DBs[dbname].allDocs({
      include_docs: true
    }).then(function (docs) {
      return docs.rows
    })
  }

  DBs[dbname].autoIncrease = function () {
    return autoIncreaseCount
      .get(dbname)
      .then(function (doc) {
        return new Promise(function (resolve) {
          autoIncreaseCount.put(doc).then(function (result) {
            if (result.ok) {
              resolve(doc.num)
            }
          })
        })
      }).catch(function (err) {
        if (err.status === 409) return DB.autoIncrease()
        return autoIncreaseCount.put({
          _id: dbname,
          num: 1
        }).then(function () {
          return 1
        })
      })
  }

  return true
}

function createFilterFunction(obj) {
  var filters = []
  Object.keys(obj).forEach(function (key) {
    if (typeof obj[key] === 'object') {
      if (obj[key].$gt) {
        filters.push({
          key: key,
          test: function (data) {
            return data > obj[key].$gt
          }
        })
      }
      if (obj[key].$lt) {
        filters.push({
          key: key,
          test: function (data) {
            return data < obj[key].$lt
          }
        })
      }
      if (obj[key].$gte) {
        filters.push({
          key: key,
          test: function (data) {
            return data >= obj[key].$gte
          }
        })
      }
      if (obj[key].$lte) {
        filters.push({
          key: key,
          test: function (data) {
            return data <= obj[key].$lte
          }
        })
      }
    } else if (typeof obj[key] === 'string') {
      filters.push({
        key: key,
        test: (new RegExp(obj[key])).test
      })
    } else if (obj[key].varructor === RegExp) {
      filters.push({
        key: key,
        test: obj[key].test
      })
    }
  })
  return function filter(row) {
    var i = filters.length
    while(i--) {
      if (filters[i].test(get(row.doc, filters[i].key))) {
        return true
      }
    }
    return false
  }
}

onmessage = function onmessage({ data }) {
  var {
    pid,
    dbname,
    name,
    names,
    value,
    conf,
    docs,
    query
  } = data

  switch (data.cmd) {
    case 'createdatabase':
      postMessage({
        pid,
        result: CreateDatabase(dbname, conf)
      })
      break

    case 'find':
      db(dbname).getAll().then(function (rows) {
        var r = []
        var selects = conf.select ? conf.select.split(' ') : false
        var filter = createFilterFunction(query)
        rows.forEach(function (row) {
          if (filter(row)) {
            if (selects) {
              var doc = row.doc
              selects.fotEach(function (select) {
                doc[select] = row.doc[select]
              })
              r.push(doc)
            } else {
              r.push(row.doc)
            }
          }
        })
        return r
      }).then(function (result) {
        postMessage({
          pid,
          result
        })
      }).catch(function (result) {
        postMessage({
          pid,
          result
        })
      })
      break

    case 'get':
      db(dbname).get(name).then(function (result) {
        postMessage({
          pid,
          result
        })
      }).catch(function (result) {
        postMessage({
          pid,
          result
        })
      })
      break

      case 'getMany':
        var Gets = []
        var DB = db(dbname)
        names.forEach(function (id) {
          Gets.push(DB.get(id))
        })
        return Promise.all(Gets).then(function (result) {
          postMessage({
            pid,
            result
          })
        }).catch(function (result) {
          postMessage({
            pid,
            result
          })
        })

    case 'getAll':
      db(dbname).getAll().then(function (rows) {
        postMessage({
          pid,
          result: rows.map(function (row) {
            return row.doc
          })
        })
      }).catch(function (result) {
        postMessage({
          pid,
          result
        })
      })
      break

    case 'push':
      db(dbname).info().then(function (info) {
        value._id = info.doc_count
        return db(dbname).put(value).then(function (result) {
          postMessage({
            pid,
            result
          })
        })
      }).catch(function (result) {
        postMessage({
          pid,
          result
        })
      })
      break

    case 'set':
      value._id = name
      db(dbname).put(value).then(function (result) {
        postMessage({
          pid,
          result
        })
      }).catch(function (result) {
        postMessage({
          pid,
          result
        })
      })
      break

      case 'update':
        db(dbname).get(name).then(function (doc) {
          doc = merge(doc, value)
          return db(dbname).put(doc).then(function (result) {
            postMessage({
              pid,
              result
            })
          })
        }).catch(function (result) {
          postMessage({
            pid,
            result
          })
        })
        break

    case 'bulkDocs':
      db(dbname).bulkDocs(docs).then(function (result) {
        postMessage({
          pid,
          result
        })
      }).catch(function (result) {
        postMessage({
          pid,
          result
        })
      })
      break

    case 'destroy':
      db(dbname).destroy().then(function (result) {
        postMessage({
          pid,
          result
        })
      }).catch(function (result) {
        postMessage({
          pid,
          result
        })
      })
      break

    case 'replicatefromcouch':
      if (db(dbname).remote) {
        db(dbname).replicate.from(db(dbname).remote)
        .on('paused', function (result) {
          postMessage({
            pid,
            result,
            on: 'paused'
          })
        })
        .on('active', function (result) {
          postMessage({
            pid,
            result,
            on: 'active'
          })
        })
        .on('denied', function (result) {
          postMessage({
            pid,
            result,
            on: 'denied'
          })
        })
        .on('compvare', function (result) {
          postMessage({
            pid,
            result,
            on: 'compvare'
          })
        })
        .on('error', function (result) {
          postMessage({
            pid,
            result,
            on: 'error'
          })
        })
      } else {
        postMessage({
          pid,
          result: {
            ok: false,
            msg: 'No remote pouch.'
          },
          on: 'error'
        })
      }
      break

    case 'replicatetocouch':
      if (db(dbname).remote) {
        db(dbname).replicate.to(db(dbname).remote)
        .on('paused', function (result) {
          postMessage({
            pid,
            result,
            on: 'paused'
          })
        })
        .on('active', function (result) {
          postMessage({
            pid,
            result,
            on: 'active'
          })
        })
        .on('denied', function (result) {
          postMessage({
            pid,
            result,
            on: 'denied'
          })
        })
        .on('complete', function (result) {
          postMessage({
            pid,
            result,
            on: 'complete'
          })
        })
        .on('error', function (result) {
          postMessage({
            pid,
            result,
            on: 'error'
          })
        })
      } else {
        postMessage({
          pid,
          result: {
            ok: false,
            msg: 'NOREMOTE'
          },
          on: 'error'
        })
      }
      break
  }
}
