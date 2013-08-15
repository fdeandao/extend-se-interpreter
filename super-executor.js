var GENEGEX = require("dummia");
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
        return this.dataStrategic[type + "-data"][name].next();
    } else {
        return this.dataStrategic[type + "-data"][name][this.currentIndex];
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

function processDataStrategic(dataStrategic, types, loopSize) {
    for (var t = 0; t < types.length; t++) {
        if (dataStrategic[types[t] + "-exp"]) {
            for (var v in dataStrategic[types[t] + "-exp"]) {
                var exp = dataStrategic[types[t] + "-exp"][v];
                if (typeof exp === "string") {
                    exp = JSON.parse(exp);
                }
                if (!dataStrategic[types[t] + "-data"]) {
                    dataStrategic[types[t] + "-data"] = {};
                }
                if (types[t] === "random") {
                    if (loopSize) {
                        exp.v = loopSize;
                    }
                    dataStrategic[types[t] + "-data"][v] = GEN.getRandomGenerator(GEN.transFromExpresion(exp), defaultSeed).run();
                } else if (types[t] === "onfly") {
                    dataStrategic[types[t] + "-data"][v] = GEN.getRandomGenerator(GEN.transFromExpresion(exp), defaultSeed);
                }
                delete dataStrategic[types[t] + "-exp"][v];
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
        return protoStep;
    },
    waitForTextPresent: function(protoStep, data) {
        protoStep.text = data;
        return protoStep;
    }
};

function buildStep(protoStep, data) {
    if (protoStep.target) {
        return (protoStep[protoStep.target] = data);
    } else if (protoStep.fullreplace === true) {
        return data;
    } else if (implementProtoSteps[protoStep["step-type"]]) {
        return implementProtoSteps[protoStep["step-type"]](protoStep, data);
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
                processDataStrategic(dataStrategic, ["random", "onfly"], loopSize);
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
                var step = tr.currentStep();
                if (step.nameCompose) {
                    var composeLen = step.nameCompose.length;
                    var name = "";
                    for(var i=0; i<composeLen; i++){
                        if(step.nameCompose[i].time){
                            name+= new Date().getTime();
                        }else if(step.nameCompose[i].sequence){
                            if(tr.loopControl[step.nameCompose[i].sequence]){
                                name+=tr.loopControl[step.nameCompose[i].sequence].currentIndex;
                            }
                        }else{
                            name+= step.nameCompose[i];
                        }
                    }
                    tr.do('takeScreenshot', [], cb, function(err, base64Image) {
                        var decodedImage = new Buffer(base64Image, 'base64');
                        cb({'success': !err, 'error': err, 'attach': {'buffer': decodedImage, 'name': name, 'type': 'png'}});
                    });
                }else{
                    cb({'success': false, 'error': "No compose name found"});
                }
            }
        };
    } else if (stepType == "intentional-error") {
        return {
            'run': function(tr, cb) {
                cb({'success': false, 'error': "intentional-error", 'message': tr.currentStep().message});
            }
        };
    }

    return null;
};