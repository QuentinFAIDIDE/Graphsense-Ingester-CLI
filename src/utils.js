function segments_overlap(a1, a2, b1, b2) {
    if (b1 >= a1 && b1 <= a2) return true;
    if (b2 >= a1 && b2 <= a2) return true;
    if (a1 >= b1 && a1 <= b2) return true;
    if (a2 >= b1 && a2 <= b2) return true;
    return false;
}

module.exports = {segments_overlap};
