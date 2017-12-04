import difflib
import sys
import argparse

from typing import List, Tuple

DiffChange = Tuple[str, int, int]

def diff_strings(output: str, expected_output: str) -> str:
    output_lines = []  # type: List[str]
    if not output.endswith('\n'):
        output += '\n'
    if not expected_output.endswith('\n'):
        expected_output += '\n'
    ndiff_output = list(difflib.ndiff(output.splitlines(True), expected_output.splitlines(True)))
    replace_is_delete = False
    for line in ndiff_output:
        if line.startswith('+'):
            replace_is_delete = False
            output_lines.append(line)
        elif line.startswith('-'):
            replace_is_delete = True
            output_lines.append(line)
        elif line.startswith('?'):
            changes_list = convert_questionmark_line(line, replace_is_delete)
            output_lines[-1] = apply_color(output_lines[-1], changes_list)
        else:
            output_lines.append(line)
    output_lines = [emphasize_codes(line) for line in output_lines]
    return "".join(output_lines)

def convert_questionmark_line(questionmark_line: str, replace_is_delete: bool) -> List[DiffChange]:
    in_insert_sequence = False
    in_delete_sequence = False
    beginning_index = None
    changes_list = []  # type: List[DiffChange]

    for index, char in enumerate(questionmark_line[2:].rstrip('\n')):
        # Replace ^ depending on context
        if char == '^':
            char = '-' if replace_is_delete else '+'

        if char == ' ':
            if in_insert_sequence:
                changes_list.append(('insert', beginning_index, index))
                in_insert_sequence = False
            elif in_delete_sequence:
                changes_list.append(('delete', beginning_index, index))
                in_delete_sequence = False
        elif char == '+':
            if not in_insert_sequence:
                if in_delete_sequence:
                    changes_list.append(('delete', beginning_index, index))
                    in_delete_sequence = False
                in_insert_sequence = True
                beginning_index = index
        elif char == '-':
            if not in_delete_sequence:
                if in_insert_sequence:
                    changes_list.append(('insert', beginning_index, index))
                    in_insert_sequence = False
                in_delete_sequence = True
                beginning_index = index
        else:
            raise ValueError(
                "Unexpected character {} in difflib.ndiff ? line output".format(char))

    if in_insert_sequence:
        changes_list.append(('insert', beginning_index, len(questionmark_line) - 2))
    if in_delete_sequence:
        changes_list.append(('delete', beginning_index, len(questionmark_line) - 2))

    return changes_list

def apply_color(input_string: str, changes: List[DiffChange]):
    processed_string = ""
    last_index = 0
    processed_string += input_string[:2]
    input_string = input_string[2:]
    for change in changes:
        if change[0] == 'insert':
            processed_string += input_string[last_index:change[1]]
            processed_string += show_added(input_string[change[1]:change[2]])
            last_index = change[2]
        elif change[0] == 'delete':
            processed_string += input_string[last_index:change[1]]
            processed_string += show_removed(input_string[change[1]:change[2]])
            last_index = change[2]
        else:
            raise ValueError("Unexpected change type {}".format(change[0]))
    processed_string += input_string[last_index:]
    return processed_string

def show_removed(string: str) -> str:
    return u"\u001b[31m" + string + u"\u001b[0m"

def show_added(string: str) -> str:
    return u"\u001b[36m" + string + u"\u001b[0m"

def emphasize_codes(string: str) -> str:
    return u"\u001b[34m" + string[:1] + u"\u001b[0m" + string[1:]

def main() -> None:
    parser = argparse.ArgumentParser(description="Diff two strings.")
    parser.add_argument("--output", nargs=1,
                        help="String to be diffed with respect to its expected value.")
    parser.add_argument("--expected_output", nargs=1,
                        help="Expected value of string.")
    args = parser.parse_args()
    diff = diff_strings(args.output, args.expected_output)
    sys.stdout.writelines(diff)

if __name__ == "__main__":
    main()
