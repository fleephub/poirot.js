
module.exports = function(grunt) {
    "use strict";

    grunt.initConfig({
        "pkg": grunt.file.readJSON("package.json"),
        "uglify": {
            "options": { "preserveComments": "some" },
            "poirot": { "files": { "dist/poirot.min.js": "poirot.js" } }
        },
        "jshint": {
            "jsfiles": { "src": ["*.js"] },
            "options": { "jshintrc": true }
        },
        "node-qunit": {
            "test": {
                "code": { "path": "poirot.js", "namespace": "poirot" },
                "tests": "test_poirot.js"
            }
        },

        /*
         * Coverage tasks
         */

        "clean": {
            "files": ["instrument"]
        },
        "copy": {
            "test": {
                "src": ["test_poirot.js"],
                "dest": "instrument/"
            }
        },
        "instrument": {
            "files": ["poirot.js"],
            "options": { "basePath": "instrument/" }
        },
        "nodeunit": {
            "test": ["test_poirot.js"],
            "coverage": ["instrument/test_poirot.js"]
        },
        "storeCoverage": {
            "options": { "dir": "instrument/" }
        },
        "makeReport": {
            "src": "instrument/*.json",
            "options": {
                "type": "lcov",
                "print": "summary",
                "dir": "instrument"
            }
        }
    });

    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-nodeunit");
    grunt.loadNpmTasks("grunt-node-qunit");
    grunt.loadNpmTasks("grunt-istanbul");

    grunt.registerTask("default", ["jshint", "test", "uglify"]);
    grunt.registerTask('test', [ 'node-qunit', 'nodeunit:test', 'cov' ]);
    grunt.registerTask('cov', ['clean', 'copy', 'instrument', 'nodeunit:coverage', 'storeCoverage', 'makeReport']);
};

