import argparse


def process_file(input_file, output_file):
    buffer = []  # To store the extracted fields temporarily
    buffer_limit = 10000  # Write to file every 10,000 lines

    with open(input_file, 'r') as infile:
        for line_number, line in enumerate(infile, start=1):
            line = line.removesuffix('\n')
            fields = line.split('\t')
            if len(fields) >= 3:
                buffer.append(fields[2])

            # Write to file when buffer reaches the limit
            if line_number % buffer_limit == 0:
                with open(output_file, 'a') as outfile:
                    outfile.write('\n'.join(buffer) + '\n')
                buffer.clear()

    # Write any remaining lines in the buffer
    if buffer:
        with open(output_file, 'a') as outfile:
            outfile.write('\n'.join(buffer) + '\n')

def main():
    parser = argparse.ArgumentParser(description="Extract the third tab-separated field from each line.")
    parser.add_argument("input_file", help="Path to the source fields file")
    parser.add_argument("output_file", help="Path to write extracted field names")
    args = parser.parse_args()
    process_file(args.input_file, args.output_file)


if __name__ == "__main__":
    main()
