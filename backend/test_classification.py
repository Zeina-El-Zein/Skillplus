from classification import classify_level, analyze_profile

SAMPLE_PROFILES = [
    # (label, year, courses, skills, expected_level)
    ("Beginner - fresh Year 1",        1, 2,  1, "Beginner"),
    ("Intermediate - courses trigger", 2, 6,  2, "Intermediate"),
    ("Intermediate - skills trigger",  1, 3,  4, "Intermediate"),
    ("Advanced - clear case",          3, 9,  7, "Advanced"),
    ("Edge case - Year 1 but experienced", 1, 10, 7, "Advanced"),
    ("Edge case - Year 1, right at Advanced threshold", 1, 8, 6, "Advanced"),
    ("Fallback - Year 2, low activity", 2, 2, 1, "Intermediate"),
]

if __name__ == "__main__":
    all_passed = True
    for label, year, courses, skills, expected in SAMPLE_PROFILES:
        result = classify_level(year, courses, skills)
        status = "PASS" if result == expected else "FAIL"
        if result != expected:
            all_passed = False
        print(f"[{status}] {label}: got={result} expected={expected}")

    print("\n--- Full output example (Issue 2) ---")
    example = analyze_profile(year=1, courses=10, skills=7)
    print(f"Level:      {example.level}")
    print(f"Strengths:  {example.strengths}")
    print(f"Missing:    {example.missing}")
    print(f"Next step:  {example.next_step}")

    print("\nAll tests passed!" if all_passed else "\nSOME TESTS FAILED.")
