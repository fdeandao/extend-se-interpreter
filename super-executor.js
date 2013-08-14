var GENEGEX = require("C:/Users/koferdo/Documents/NetBeansProjects/dummia/genegex_util.js");
var GEN = new GENEGEX.GENREX();
var defaultSeed = new GEN.getDefaultSeed();
/**
 * TODO
 * FOR 
 * */
var LoopControl = function(dataStrategic, loopSize, startIndex) {
    this.loopSize = loopSize;
    this.dataStrategic = dataStrategic;
    this.startIndex = startIndex;
    this.currentIndex = 0;
};
LoopControl.prototype.next = function() {
    this.currentIndex++;
    return this.currentIndex < this.loopSize;
};
LoopControl.prototype.getData = function(type, name) {
    if (type === "onfly") {
        return this.dataStrategic[type][name].next();
    } else {
        return this.dataStrategic[type][name][this.currentIndex];
    }
};
/* Return the first occurs */
LoopControl.prototype.defaultGetData = function() {
    for (var type in this.dataStrategic) {
        for (var name in this.dataStrategic[type]) {
            if (type === "onfly") {
                return this.dataStrategic[type][name].next();
            } else {
                return this.dataStrategic[type][name][this.currentIndex];
            }
        }
    }
};

function processDataStrategic(dataStrategic, types) {
    for (var type in types) {
        if (dataStrategic[type + "-exp"]) {
            for (var v in dataStrategic[type + "-exp"]) {
                var exp = dataStrategic[type + "-exp"][v];
                if (typeof exp === "string") {
                    exp = JSON.parse(exp);
                }
                if (!dataStrategic[type + "-data"]) {
                    dataStrategic[type + "-data"] = {};
                }
                if (type === "random") {
                    dataStrategic[type + "-data"][v] = GEN.getRandomGenerator(GEN.transFromExpresion(exp), defaultSeed).run();
                } else if (type === "onfly") {
                    dataStrategic[type + "-data"][v] = GEN.getRandomGenerator(GEN.transFromExpresion(exp), defaultSeed);
                }
                delete dataStrategic[type + "-exp"][v];
            }
        }
    }
}

function callStepExecutor(tr, cb, steptype) {
    var executor = null;
    var i = 0;
    while (!executor && i < tr.executorFactories.length) {
        executor = tr.executorFactories[i++].get(steptype);
    }
    if (executor) {
        executor.run(tr, cb);
    } else {
        throw "Unable to load step type " + steptype;
    }
}

var implementProtoSteps = {
    clickElement: function(protoStep, data) {
        protoStep.locator.value = data;
        return protoStep;
    },
    setElementText: function(protoStep, data) {
        protoStep.text = data;
    },
    waitForTextPresent: function(protoStep, data) {
        protoStep.text = data;
    }
};

function buildStep(protoStep, data) {
    if (protoStep.target) {
        return (protoStep[protoStep.target] = data);
    }else if(protoStep.fullreplace === true){
        return data;
    }else if (implementProtoSteps[protoStep.otype]) {
        return implementProtoSteps[protoStep.otype](protoStep, data);
    } else {
        throw "Implement for protoStep not found " + protoStep.type;
    }
}

exports.get = function(stepType) {
    if (stepType == "super-for") {
        return {
            'run': function(tr, cb) {
                var loopName = tr.p('loop-name');
                var loopSize;
                try {
                    loopSize = tr.p('loop-size');
                } catch (e) {
                }
                if (!tr.loopControl) {
                    tr.loopControl = {};
                }
                if (tr.loopControl[loopName]) {
                    throw "super-for already exists " + loopName;
                }
                var dataStrategic = tr.p('data-strategic');
                processDataStrategic(dataStrategic, ["random", "fly"]);
                tr.loopControl[loopName] = new LoopControl(dataStrategic, loopSize, tr.stepIndex);
                cb({'success': true});
            }
        };
    } else if (stepType == "super-for-end") {
        return {
            'run': function(tr, cb) {
                var loopName = tr.p('loop-name');
                if (!tr.loopControl || !tr.loopControl[loopName]) {
                    throw "No initial super-for found for " + loopName;
                }
                if (tr.loopControl[loopName].next()) {
                    tr.stepIndex = tr.loopControl[loopName].startIndex;
                } else {
                    delete tr.loopControl[loopName];
                }
                cb({'success': true});
            }
        };
    } else if (stepType == "super-for-data") {
        return {
            'run': function(tr, cb) {
                var loopName = tr.p('loopName');
                var step = tr.currentStep();
                if (!tr.loopControl || !tr.loopControl[loopName]) {
                    throw "No initial super-for found for " + loopName;
                }
                var loopControl = tr.loopControl[loopName];
                var data = loopControl.defaultGetData();
                var target = step.target || "text";
                var type = step["step-type"] || "setElementText";
                step[target] = data;
                callStepExecutor(tr, cb, type);

            }
        };
    } else if (stepType == "super-for-build-steps") {
        return {
            'run': function(tr, cb) {
                var loopName = tr.p('loop-name');
                if (!tr.loopControl || !tr.loopControl[loopName]) {
                    throw "No initial super-for found for " + loopName;
                }
                var loopControl = tr.loopControl[loopName];
                if (!loopControl.stepsbuilded) {
                    var protoSteps = tr.p('proto-steps');
                    var protolen = protoSteps.length;
                    var steps = tr.script.steps;
                    var index = tr.stepIndex + 1;
                    for (var i = 0; i < protolen; i++) {
                        var step = protoSteps[i];
                        /* save original type */
                        step["step-type"] = step.type;
                        step.type = "super-for-proto-step";
                        steps.splice(index++, 0, step);
                    }
                }
                cb({'success': true, "stepsbuilded": loopControl.stepsbuilded});
                loopControl.stepsbuilded = 1;
            }
        };
    } else if (stepType == "super-for-proto-step") {
        return {
            'run': function(tr, cb) {
                var loopName = tr.p('loop-name');
                if (!tr.loopControl || !tr.loopControl[loopName]) {
                    throw "No initial super-for found for " + loopName;
                }
                var typeData = tr.p('type-data');
                var nameData = tr.p('name-data');
                var loopControl = tr.loopControl[loopName];
                var step = tr.currentStep();
                var dataStrategic = loopControl.getData(typeData, nameData);
                step = buildStep(step, dataStrategic);
                callStepExecutor(tr, cb, step["step-type"]);
            }
        };
    } else if (stepType == "random-data") {
        return {
            'run': function(tr, cb) {
                var step = tr.currentStep();
                var exp = step["random-exp"];
                var target = step.target || "text";
                var type = step["step-type"] || "setElementText";
                if (typeof exp === "string") {
                    exp = JSON.parse(exp);
                }
                step[target] = GEN.getRandomGenerator(GEN.transFromExpresion(exp), defaultSeed).next();
                callStepExecutor(tr, cb, type);

            }
        };
    } else if (stepType == "attach-screenshot") {
        return {
            'run': function(tr, cb) {
                tr.do('takeScreenshot', [], cb, function(err, base64Image) {
                    var decodedImage = new Buffer(base64Image, 'base64');
                    var name = tr.p('name');
                    cb({'success': !err, 'error': err, 'attach': {'buffer': decodedImage, 'name': name + new Date().getTime(), 'type': 'png'}});
                });
            }
        };
    }

    return null;
};
