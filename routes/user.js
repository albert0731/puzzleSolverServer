
/*
 * GET users listing.
 */
var ROWS = 5;
var COLS = 6;
var TYPES = 7;
var ORB_X_SEP = 64;
var ORB_Y_SEP = 64;
var ORB_WIDTH = 60;
var ORB_HEIGHT = 60;
var MULTI_ORB_BONUS = 0.25;
var COMBO_BONUS = 0.25;
var MAX_SOLUTIONS_COUNT = ROWS * COLS * 8 * 2;
var MAX_LENGTH;
exports.list = function(req, res){
  var inputboard = req.query.board;
  
  var sourceboard = get_board(inputboard);
  var allsolutions;
  
  solve_board(sourceboard, function(p, max_p) {
  
  }, function(solutions) {
	  allsolutions = solutions;
	  res.send(solutions[0].init_cursor.row+","+solutions[0].init_cursor.col+";"
			  +solutions[0].cursor.row+","+solutions[0].cursor.col+";"
			  +solutions[0].path.toString());
  });
};

function make_rc(row, col) {
    return {row: row, col: col};
}

function make_match(type, count) {
    return {type: type, count: count};
}

function to_xy(rc) {
    var x = rc.col * ORB_X_SEP + ORB_WIDTH/2;
    var y = rc.row * ORB_Y_SEP + ORB_HEIGHT/2;
    return {x: x, y: y};
}

function copy_rc(rc) {
    return {row: rc.row, col: rc.col};
}

function equals_xy(a, b) {
    return a.x == b.x && a.y == b.y;
}

function equals_rc(a, b) {
    return a.row == b.row && a.col == b.col;
}

function create_empty_board() {
    var result = new Array(ROWS);
    for (var i = 0; i < ROWS; ++ i) {
        result[i] = new Array(COLS);
    }
    return result;
}

function get_board(inputboard) {
    var result = create_empty_board();
    var k=0;
   for(var i=0;i<5;++i){
	   for(var j=0;j<6;j++){
		   result[i][j] = inputboard[k];
		   k++;
	   }
   } 
   return result;
}

function ensure_no_X(board) {
    for (var i = 0; i < ROWS; ++ i) {
        for (var j = 0; j < COLS; ++ j) {
            if (board[i][j] == 'X') {
                throw 'Cannot have "?" orbs when solving.';
            }
        }
    }
}

function copy_board(board) {
    return board.map(function(a) { return a.slice(); });
}

function get_type(elem) {
    return elem.className.match(/e([\dX])/)[1];
}

function advance_type(type, dt) {
    if (type == 'X') {
        return '0';
    } else {
        var new_type = dt + +type;
        if (new_type < 0) {
            new_type += TYPES;
        } else if (new_type >= TYPES) {
            new_type -= TYPES;
        }
        return new_type;
    }
}

function get_weights() {
    var weights = new Array(TYPES);
    for (var i = 0; i < TYPES; ++ i) {
        weights[i] = {
            normal: 1,
            mass: 3,
        };
    }
    return weights;
}

function find_matches(board) {
    var match_board = create_empty_board();

    // 1. filter all 3+ consecutives.
    //  (a) horizontals
    for (var i = 0; i < ROWS; ++ i) {
        var prev_1_orb = 'X';
        var prev_2_orb = 'X';
        for (var j = 0; j < COLS; ++ j) {
            var cur_orb = board[i][j];
            if (prev_1_orb == prev_2_orb && prev_2_orb == cur_orb && cur_orb != 'X') {
                match_board[i][j] = cur_orb;
                match_board[i][j-1] = cur_orb;
                match_board[i][j-2] = cur_orb;
            }
            prev_1_orb = prev_2_orb;
            prev_2_orb = cur_orb;
        }
    }
    //  (b) verticals
    for (var j = 0; j < COLS; ++ j) {
        var prev_1_orb = 'X';
        var prev_2_orb = 'X';
        for (var i = 0; i < ROWS; ++ i) {
            var cur_orb = board[i][j];
            if (prev_1_orb == prev_2_orb && prev_2_orb == cur_orb && cur_orb != 'X') {
                match_board[i][j] = cur_orb;
                match_board[i-1][j] = cur_orb;
                match_board[i-2][j] = cur_orb;
            }
            prev_1_orb = prev_2_orb;
            prev_2_orb = cur_orb;
        }
    }

    var scratch_board = copy_board(match_board);

    // 2. enumerate the matches by flood-fill.
    var matches = [];
    for (var i = 0; i < ROWS; ++ i) {
        for (var j = 0; j < COLS; ++ j) {
            var cur_orb = scratch_board[i][j];
            if (typeof(cur_orb) == 'undefined') { continue; }
            var stack = [make_rc(i, j)];
            var count = 0;
            while (stack.length) {
                var n = stack.pop();
                if (scratch_board[n.row][n.col] != cur_orb) { continue; }
                ++ count;
                scratch_board[n.row][n.col] = undefined;
                if (n.row > 0) { stack.push(make_rc(n.row-1, n.col)); }
                if (n.row < ROWS-1) { stack.push(make_rc(n.row+1, n.col)); }
                if (n.col > 0) { stack.push(make_rc(n.row, n.col-1)); }
                if (n.col < COLS-1) { stack.push(make_rc(n.row, n.col+1)); }
            }
            matches.push(make_match(cur_orb, count));
        }
    }

    return {matches: matches, board: match_board};
}

function equals_matches(a, b) {
    if (a.length != b.length) {
        return false;
    }
    return a.every(function(am, i) {
        var bm = b[i];
        return am.type == bm.type && am.count == bm.count;
    });
}

function compute_weight(matches, weights) {
    var total_weight = 0;
    matches.forEach(function(m) {
        var base_weight = weights[m.type][m.count >= 5 ? 'mass' : 'normal'];
        var multi_orb_bonus = (m.count - 3) * MULTI_ORB_BONUS + 1;
        total_weight += multi_orb_bonus * base_weight;
    });
    var combo_bonus = (matches.length - 1) * COMBO_BONUS + 1;
    return total_weight * combo_bonus;
}

function show_element_type(jqel, type) {
    jqel.removeClass('eX');
    for (var i = 0; i < TYPES; ++ i) {
        jqel.removeClass('e' + i);
    }
    jqel.addClass('e' + type);
}

function show_board(board) {
    for (var i = 0; i < ROWS; ++ i) {
        for (var j = 0; j < COLS; ++ j) {
            var type = board[i][j];
            if (typeof(type) == 'undefined') {
                type = 'X';
            }
            show_element_type($('#o' + i + '' + j), type);
        }
    }
}

function in_place_remove_matches(board, match_board) {
    for (var i = 0; i < ROWS; ++ i) {
        for (var j = 0; j < COLS; ++ j) {
            if (typeof(match_board[i][j]) != 'undefined') {
                board[i][j] = 'X';
            }
        }
    }
    return board;
}

function in_place_drop_empty_spaces(board) {
    for (var j = 0; j < COLS; ++ j) {
        var dest_i = ROWS-1;
        for (var src_i = ROWS-1; src_i >= 0; -- src_i) {
            if (board[src_i][j] != 'X') {
                board[dest_i][j] = board[src_i][j];
                -- dest_i;
            }
        }
        for (; dest_i >= 0; -- dest_i) {
            board[dest_i][j] = 'X';
        }
    }
    return board;
}

function can_move_orb(rc, dir) {
    switch (dir) {
        case 0: return                    rc.col < COLS-1;
        case 1: return rc.row < ROWS-1 && rc.col < COLS-1;
        case 2: return rc.row < ROWS-1;
        case 3: return rc.row < ROWS-1 && rc.col > 0;
        case 4: return                    rc.col > 0;
        case 5: return rc.row > 0      && rc.col > 0;
        case 6: return rc.row > 0;
        case 7: return rc.row > 0      && rc.col < COLS-1;
    }
    return false;
}

function in_place_move_rc(rc, dir) {
    switch (dir) {
        case 0:              rc.col += 1; break;
        case 1: rc.row += 1; rc.col += 1; break;
        case 2: rc.row += 1;              break;
        case 3: rc.row += 1; rc.col -= 1; break;
        case 4:              rc.col -= 1; break;
        case 5: rc.row -= 1; rc.col -= 1; break;
        case 6: rc.row -= 1;              break;
        case 7: rc.row -= 1; rc.col += 1; break;
    }
}

function in_place_swap_orb(board, rc, dir) {
    var old_rc = copy_rc(rc);
    in_place_move_rc(rc, dir);
    var orig_type = board[old_rc.row][old_rc.col];
    board[old_rc.row][old_rc.col] = board[rc.row][rc.col];
    board[rc.row][rc.col] = orig_type;
    return {board: board, rc: rc};
}

function copy_solution_with_cursor(solution, i, j, init_cursor) {
    return {board: copy_board(solution.board),
            cursor: make_rc(i, j),
            init_cursor: init_cursor || make_rc(i, j),
            path: solution.path.slice(),
            is_done: solution.is_done,
            weight: 0,
            matches: []};
}

function copy_solution(solution) {
    return copy_solution_with_cursor(solution,
                                     solution.cursor.row, solution.cursor.col,
                                     solution.init_cursor);
}

function make_solution(board) {
    return {board: copy_board(board),
            cursor: make_rc(0, 0),
            init_cursor: make_rc(0, 0),
            path: [],
            is_done: false,
            weight: 0,
            matches: []};
}

function in_place_evaluate_solution(solution, weights) {
    var current_board = copy_board(solution.board);
    var all_matches = [];
    while (true) {
        var matches = find_matches(current_board);
        if (matches.matches.length == 0) {
            break;
        }
        in_place_remove_matches(current_board, matches.board);
        in_place_drop_empty_spaces(current_board);
        all_matches = all_matches.concat(matches.matches);
    }
    solution.weight = compute_weight(all_matches, weights);
    solution.matches = all_matches;
    return current_board;
}

function can_move_orb_in_solution(solution, dir) {
    // Don't allow going back directly. It's pointless.
    if (solution.path[solution.path.length-1] == (dir + 4) % 8) {
        return false;
    }
    return can_move_orb(solution.cursor, dir);
}

function in_place_swap_orb_in_solution(solution, dir) {
    var res = in_place_swap_orb(solution.board, solution.cursor, dir);
    solution.cursor = res.rc;
    solution.path.push(dir);
}

function get_max_path_length() {
    return 16;
}

function is_8_dir_movement_supported() {
    return false;
}

function evolve_solutions(solutions, weights, dir_step) {
    var new_solutions = [];
    solutions.forEach(function(s) {
        if (s.is_done) {
            return;
        }
        for (var dir = 0; dir < 8; dir += dir_step) {
            if (!can_move_orb_in_solution(s, dir)) {
                continue;
            }
            var solution = copy_solution(s);
            in_place_swap_orb_in_solution(solution, dir);
            in_place_evaluate_solution(solution, weights);
            new_solutions.push(solution);
        }
        s.is_done = true;
    });
    solutions = solutions.concat(new_solutions);
    solutions.sort(function(a, b) { return b.weight - a.weight; });
    return solutions.slice(0, MAX_SOLUTIONS_COUNT);
}

function solve_board(board, step_callback, finish_callback) {
    var solutions = new Array(ROWS * COLS);
    var weights = get_weights();

    var seed_solution = make_solution(board);
    in_place_evaluate_solution(seed_solution, weights);

    for (var i = 0, s = 0; i < ROWS; ++ i) {
        for (var j = 0; j < COLS; ++ j, ++ s) {
            solutions[s] = copy_solution_with_cursor(seed_solution, i, j);
        }
    }

    var solve_state = {
        step_callback: step_callback,
        finish_callback: finish_callback,
        max_length: get_max_path_length(),
        dir_step: is_8_dir_movement_supported() ? 1 : 2,
        p: 0,
        solutions: solutions,
        weights: weights,
    };

    solve_board_step(solve_state);
}

function solve_board_step(solve_state) {
    if (solve_state.p >= solve_state.max_length) {
        solve_state.finish_callback(solve_state.solutions);
        return;
    }

    ++ solve_state.p;
    solve_state.solutions = evolve_solutions(solve_state.solutions,
                                             solve_state.weights,
                                             solve_state.dir_step);
    solve_state.step_callback(solve_state.p, solve_state.max_length);

    setTimeout(function() { solve_board_step(solve_state); }, 0);
}


function simplify_path(xys) {
    // 1. Remove intermediate points.
    var simplified_xys = [xys[0]];
    var xys_length_1 = xys.length - 1;
    for (var i = 1; i < xys_length_1; ++ i) {
        var dx0 = xys[i].x - xys[i-1].x;
        var dx1 = xys[i+1].x - xys[i].x;
        if (dx0 == dx1) {
            var dy0 = xys[i].y - xys[i-1].y;
            var dy1 = xys[i+1].y - xys[i].y;
            if (dy0 == dy1) {
                continue;
            }
        }
        simplified_xys.push(xys[i]);
    }
    simplified_xys.push(xys[xys_length_1]);

    return simplified_xys;
}

function simplify_solutions(solutions) {
    var simplified_solutions = [];
    solutions.forEach(function(solution) {
        for (var s = simplified_solutions.length-1; s >= 0; -- s) {
            var simplified_solution = simplified_solutions[s];
            if (!equals_rc(simplified_solution.init_cursor, solution.init_cursor)) {
                continue;
            }
            if (!equals_matches(simplified_solution.matches, solution.matches)) {
                continue;
            }
            return;
        }
        simplified_solutions.push(solution);
    });
    return simplified_solutions;
}

