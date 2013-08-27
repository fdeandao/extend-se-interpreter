var os = require("os");
var fs = require('fs');
var cdb;
try {
    cdb = require("couchdb-api");
} catch (e) {
}
;
var util = require('util');
var exetime = new Date().getTime();
var db;
var DB = function(DBSERVER) {
    this.DBSERVER = DBSERVER;
    this._conf = DBSERVER.COUCH;
    this._client = cdb.srv("http://" + this._conf.host + ":" + this._conf.port);
    this._client.auth = this._conf.user + ":" + this._conf.password;
    this._db = this._client.db(this._conf.dbName);
    return this;
};

DB.prototype.saveTest = function(testData) {
    function attachFile(docName, test, attachsP) {
        var attachs = attachsP;
        var attach = attachs.pop();
        if (attach) {
            var attachment = test.attachment(attach.name);
            attachment.setBody(attach.type, attach.buffer);
            attachment.save(function(e) {
                if (e) {
                    console.error(JSON.stringify(e));
                }
                if (attachs) {
                    attachFile(docName, test, attachs);
                }
            });
        }
    }
    var tid = new Date().getTime();
    var docName = testData.info.name + "." + tid;
    var newTest = this._db.doc(docName);
    var attachs = [];
    for (var i = 0; i < testData.endStep.length; i++) {
        if (testData.endStep[i].info && testData.endStep[i].info.attach) {
            attachs.push(testData.endStep[i].info.attach);
            testData.endStep[i].info.attachname = testData.endStep[i].info.attach.name;
            delete testData.endStep[i].info.attach;
        }
    }
    newTest.body = testData;
    newTest.save(function(e) {
        if (e) {
            console.error(JSON.stringify(e));
        }else{
            attachFile(docName, newTest, attachs);
        }
    });
};

var listeners = {
    get: function() {
        return this.listener;
    },
    console: {
        get: function() {
            return this.listener;
        },
        listener: {
            'startTestRun': function(testRun, info) {
                console.log("Listener: test run starting!");
                console.log("Listener: success: " + info.success);
                console.log("Listener: error: " + util.inspect(info.error));
            },
            'endTestRun': function(testRun, info) {
                console.log("Listener: test run ending!");
                console.log("Listener: success: " + info.success);
                console.log("Listener: error: " + util.inspect(info.error));
            },
            'startStep': function(testRun, step) {
                console.log("Listener: step starting!");
                console.log("Listener: " + JSON.stringify(step));
            },
            'endStep': function(testRun, step, info) {
                console.log("Listener: step ending!");
                console.log("Listener: " + JSON.stringify(step));
                console.log("Listener: success: " + info.success);
                console.log("Listener: error: " + util.inspect(info.error));
                if (info.attach) {
                    fs.writeFile(info.attach.name + '.' + info.attach.type, info.attach.buffer, function(err) {
                        if (err)
                            console.log("Writefile: error: " + util.inspect(err));
                    });
                }
            }
        }
    },
    couchdb: {
        get: function(db) {
            this.listener.db = this.listener.db || db;
            return this.listener;
        },
        listener: {
            'startTestRun': function(testRun, info) {
                this.data = {startTestRun: {}, endTestRun: {}, startStep: [], endStep: []};
                //this.data.startTestRun.script = testRun.script;
                this.data.info = {};
                this.data.info.browserOptions = testRun.browserOptions;
                this.data.info.driverOptions = testRun.driverOptions;
                this.data.info.hostname = os.hostname();
                this.data.info.name = testRun.name;
                this.data.type = "test";
                this.data.startTime = exetime;
                this.data.startTestRun.info = info;
            },
            'endTestRun': function(testRun, info) {
                this.data.endTestRun.info = info;
                this.db.saveTest(this.data);
            },
            'startStep': function(testRun, step) {
                this.data.startStep.push({step: step});
            },
            'endStep': function(testRun, step, info) {
                this.data.endStep.push({step: step, info: info});
            }
        }
    }
};
/** An example interpreter listener factory with all listener functions implemented. */
exports.getInterpreterListener = function(testRun, listenerOptions, exports) {
    if (!db && listenerOptions.type === "couchdb") {
        var DBSERVER;
        if (!listenerOptions) {
            throw "No listenerOptions";
        }
        if (listenerOptions.dbserver) {
            if (typeof listenerOptions.dbserver === "string") {
                DBSERVER = JSON.parse(fs.readFileSync(listenerOptions.dbserver));
            } else {
                DBSERVER = listenerOptions.dbserver;
            }
        }
        db = new DB(DBSERVER);
    }
    if (listenerOptions.type) {
        if (listeners[listenerOptions.type]) {
            return listeners[listenerOptions.type].get(db);
        } else {
            throw "No listener found " + listenerOptions.type;
        }
    } else {
        throw "No listener type request";
    }
};
