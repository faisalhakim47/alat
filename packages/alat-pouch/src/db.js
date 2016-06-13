var DatabaseWorker = require('worker!./db-worker')
var merge = require('lodash.merge')

var DBs = {}
var DBWorker = new DatabaseWorker()
var Queue = {}
var settings = {}
var queIndex = 0

DBWorker.onmessage = function onmessage(e) {
  Queue[e.data.pid](e)
}

function db(dbname) {
  if (!dbname) throw new Error('dbname must be defined.')

  if (DBs[dbname]) return DBs[dbname]

  throw new Error('Database have not been created yet.')
}

db.createDatabase = function createDatabase(dbname, conf = {}) {
  if (!dbname) throw new Error('dbname must be defined.')

  function postMessage(msg) {
    var pid = queIndex++
    DBWorker.postMessage(deepMerge(msg, { pid, dbname }))
    return pid
  }

  DBs[dbname] = {
    find(query, conf) {
      var pid = postMessage({
        conf,
        query,
        cmd: 'find'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    get(name) {
      var pid = postMessage({
        name,
        cmd: 'get'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    getMany(names) {
      var pid = postMessage({
        names,
        cmd: 'getMany'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    getAll() {
      var pid = postMessage({
        cmd: 'getAll'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    push(value) {
      var pid = postMessage({
        value,
        cmd: 'push'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    set(name, value) {
      var pid = postMessage({
        name,
        value,
        cmd: 'set'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    put(value) {
      return this.set(value._id, value)
    },

    update(name, value) {
      var pid = postMessage({
        name,
        value,
        cmd: 'update'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    bulkDocs(docs) {
      var pid = postMessage({
        docs,
        cmd: 'bulkDocs'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    remove(name, value) {
      var pid = postMessage({
        name,
        cmd: 'remove'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    destroy() {
      var pid = postMessage({
        cmd: 'destroy'
      })
      return new Promise(function (resolve) {
        Queue[pid] = function (e) {
          resolve(e.data.result)
          delete Queue[pid]
        }
      })
    },

    replicate(direction, target) {
      var pid = postMessage({
        cmd: `replicate${direction.toLowerCase()}${target.toLowerCase()}`
      })
      var cbs = {}
      var event = {
        on(name, cb) {
          cbs[name] = cb
          return event
        },
        await: new Promise(function (resolve, reject) {
          Queue[pid] = function (e) {
            if (typeof cbs[e.data.on] === 'function') {
              cbs[e.data.on](e.data.result)
            }
            if (e.data.on === 'complete') {
              resolve(e.data.result)
              delete Queue[pid]
            }
            if (e.data.on === 'error') {
              reject(e.data.result)
              delete Queue[pid]
            }
          }
        })
      }
      return event
    },

    replicateFromCouch() {
      return this.replicate('from', 'couch')
    },

    replicateToCouch() {
      return this.replicate('to', 'couch')
    }
  }

  conf = deepMerge(conf, settings)

  var pid = postMessage({
    conf,
    cmd: 'createdatabase'
  })

  return new Promise(function (resolve) {
    Queue[pid] = function (e) {
      resolve(e.data.result)
    }
  })
}

db.replicate = function () {
  var dbnames = arguments

  if (Array.isArray(dbnames[0])) {
    dbnames = dbnames[0]
  }
  return {
    from: {
      couch() {
        var r = []
        dbnames.forEach(function (dbname) {
          r.push(
            DBs[dbname].replicate('from', 'couch').await
          )
        })
        return Promise.all(r)
      }
    },
    to: {
      couch() {
        var r = []
        dbnames.forEach(function (dbname) {
          r.push(
            DBs[dbname].replicateToCouch('to', 'couch').await
          )
        })
        return Promise.all(r)
      }
    }
  }
}

db.set = function (name, value) {
  settings[name] = value
}

module.exports = db

// db('name db').destroy().then((r) => console.log(((new Date()).getTime() - time) + 'ms', r))
//
// var time = (new Date()).getTime()
//
// db('name db').set('ok0', { test: 987 }).then((result) => {
//   console.log(((new Date()).getTime() - time) + 'ms', result)
// })
//
// db('name db').set('ok1', { test: 1 }).then((result) => {
//   console.log(((new Date()).getTime() - time) + 'ms', result)
// })
//
// db('name db').set('ok2', { test: 2 }).then((result) => {
//   console.log(((new Date()).getTime() - time) + 'ms', result)
// })
//
// db('name db').get('ok0').then((result) => {
//   console.log(((new Date()).getTime() - time) + 'ms', result)
// })
//
// db('name db').getMany(['ok1', 'ok0', 'ok2']).then((result) => {
//   console.log(((new Date()).getTime() - time) + 'ms', result)
// })
//
// var docs = []
//
// for (var i = 0; i < 100; i++) {
//   docs.push({
//     _id: 'id-' + i,
//     value: i,
//   })
// }
//
// db('name db').bulkDocs(docs).then((result) => {
//   console.log(((new Date()).getTime() - time) + 'ms', result)
// })
//
// db('name db').getAll().then((result) => {
//   console.log(((new Date()).getTime() - time) + 'ms', result)
// })
//
// db('name db').find({ _id: /id-10/ }).then((result) => {
//   console.log(((new Date()).getTime() - time) + 'ms', result)
// })
