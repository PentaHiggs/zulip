var mdiff = (function () {

var _ = require('/srv/zulip/node_modules/underscore/underscore.js');
var difflib = require('difflib');
var exports = {};

function show_removed(string) {
    return "\u001b[31m" + string + "\u001b[0m";
}

function show_added(string) {
    return "\u001b[36m" + string + "\u001b[0m";
}

function emphasize_codes(string) {
    return "\u001b[34m" + string.slice(0,1)  + "\u001b[0m" + string.slice(1);
}

function apply_color(input_string, changes) {
    var last_index = 0;
    var processed_string = input_string.slice(0,2);
    input_string = input_string.slice(2);

    _.forEach(changes, function (change) {
        if (change.tag === "insert") {
            processed_string += input_string.slice(last_index, change.beginning_index);
            processed_string += show_added(
                input_string.slice(change.beginning_index, change.index)
            );
            last_index = change.index;
        } else if (change.tag === "delete") {
            processed_string += input_string.slice(last_index, change.beginning_index);
            processed_string += show_removed(
                input_string.slice(change.beginning_index, change.index)
            );
            last_index = change.index;
        } else {
            // No coloring.
            processed_string += input_string.slice(last_index, change.index);
            last_index = change.index;
        }
    });

    processed_string += input_string.slice(last_index);
    return processed_string;
}

function convert_questionmark_line(questionmark_line, replace_is_delete) {
    var in_insert_sequence = false;
    var in_delete_sequence = false;
    var beginning_index = 0;
    var changes_list = [];

    // Split might not play well with Unicode.  ES6 has a better solution...
    _.forEach(questionmark_line.slice(2).split(""), function (character, index) {
        if (character === "^") {
            character = replace_is_delete ? "-" : "+";
        }

        if (character === " ") {
            if (in_insert_sequence) {
                changes_list.push({
                    tag : "insert",
                    beginning_index,
                    index,
                });
                in_insert_sequence = false;
            } else if (in_delete_sequence) {
                changes_list.push({
                    tag : "delete",
                    beginning_index,
                    index,
                });
                in_delete_sequence = false;
            }
        } else if (character === "+") {
            if (!in_insert_sequence) {
                if (in_delete_sequence) {
                    changes_list.push({
                        tag : "delete",
                         beginning_index,
                        index,
                    });
                    in_delete_sequence = false;
                }
                in_insert_sequence = true;
                beginning_index = index;
            }
        } else if (character === "-") {
            if (!in_delete_sequence) {
                if (in_insert_sequence) {
                    changes_list.push({
                        tag : "insert",
                        beginning_index,
                        index,
                    });
                    in_insert_sequence = false;
                }
                in_delete_sequence = true;
                beginning_index = index;
            }
        } else {
            // Do nothing; Most likely newline at end.
        }

    });

    if (in_insert_sequence) {
        changes_list.push({
            tag : "insert",
            beginning_index,
            index : questionmark_line.length - 2,
        });
    }

    if (in_delete_sequence) {
        changes_list.push({
            tag : "delete",
            beginning_index,
            index : questionmark_line.length - 2,
        });
    }

    return changes_list;
}

exports.diff_strings = function diff_strings(output, expected_output) {
    var output_lines = [];
    var ndiff_output = "";
    var replace_is_delete = false;
    var changes_list = [];

    ndiff_output = difflib.ndiff(output.split("\n"), expected_output.split("\n"));

    _.forEach(ndiff_output, function (line) {
        if (line.startsWith("+")) {
            replace_is_delete = false;
            output_lines.push(line);
        } else if (line.startsWith("-")) {
            replace_is_delete = true;
            output_lines.push(line);
        } else if (line.startsWith("?")) {
            changes_list = convert_questionmark_line(line, replace_is_delete);
            output_lines[output_lines.length - 1] = apply_color(
                output_lines[output_lines.length -1], changes_list);
        } else {
            output_lines.push(line);
        }
    });

    output_lines = _.map(output_lines, emphasize_codes);
    return output_lines.join("\n");
};

exports.assert_equal_markdown = function (expected_output, output) {
    assert.equal(expected_output, output, {
        toString() {
            return "output != expected_output\n" + exports.diff_strings(output, expected_output);
        },
    });
};

return exports;
}());
module.exports = mdiff;
