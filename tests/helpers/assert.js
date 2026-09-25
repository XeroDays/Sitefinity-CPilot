function createAssert() {
    let failed = false;

    function assert(label, condition) {
        if (!condition) {
            console.error("FAIL:", label);
            failed = true;
        }
    }

    function finish() {
        if (failed) {
            console.error("FAIL");
            process.exit(1);
        }
        console.log("PASS");
    }

    return { assert, finish };
}

module.exports = { createAssert };
