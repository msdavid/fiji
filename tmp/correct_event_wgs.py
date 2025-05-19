import json

def correct_event_working_groups(input_filepath: str, output_filepath: str, events_to_fix: dict):
    """
    Reads event data from a JSON file, updates specified events with a new working group ID,
    and saves the corrected data to a new JSON file.

    Args:
        input_filepath (str): Path to the input JSON file (e.g., "tmp/events_backup.json").
        output_filepath (str): Path to save the corrected JSON file (e.g., "tmp/events_corrected.json").
        events_to_fix (dict): A dictionary where keys are event IDs to fix, and values are
                              the list of workingGroupIds to assign (e.g., {"eventId": ["wgId1"]}).
    """
    try:
        with open(input_filepath, 'r') as f:
            events_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{input_filepath}' not found.")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{input_filepath}'.")
        return

    if not isinstance(events_data, dict):
        print("Error: Expected input JSON to be a dictionary of event_id: event_data.")
        return

    updated_count = 0
    for event_id, new_wg_ids in events_to_fix.items():
        if event_id in events_data:
            if isinstance(events_data[event_id], dict):
                events_data[event_id]["workingGroupIds"] = new_wg_ids
                # Remove old single workingGroupId if it exists, as workingGroupIds is now the source of truth
                if "workingGroupId" in events_data[event_id]:
                    del events_data[event_id]["workingGroupId"]
                updated_count += 1
                print(f"Updated event '{event_id}' with workingGroupIds: {new_wg_ids}")
            else:
                print(f"Warning: Data for event_id '{event_id}' is not a dictionary. Skipping.")
        else:
            print(f"Warning: Event ID '{event_id}' not found in the input file. Skipping.")

    try:
        with open(output_filepath, 'w') as f:
            json.dump(events_data, f, indent=2)
        print(f"Corrected data for {updated_count} event(s) saved to '{output_filepath}'.")
    except IOError:
        print(f"Error: Could not write to output file '{output_filepath}'.")

if __name__ == "__main__":
    events_to_update = {
        "KzZTX2LNAKZGA8IxFJWc": ["I6gbTNLjjCtVBoG2uJMz"],
        "3uOvLcLKjJjDvQuSuAF3": ["I6gbTNLjjCtVBoG2uJMz"],
        "BgCR4nx2oSDEPUpctUDZ": ["I6gbTNLjjCtVBoG2uJMz"],
        "ZJd6MJcA67ixnkbFrESy": ["I6gbTNLjjCtVBoG2uJMz"]
        # Add other event IDs and their desired workingGroupIds lists here if needed
    }
    
    input_json_path = "tmp/events_backup.json"
    output_json_path = "tmp/events_corrected.json"
    
    correct_event_working_groups(input_json_path, output_json_path, events_to_update)