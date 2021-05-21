var secondsFactor = 0.0029024875016400026;
var importance_threshold = 0.4;
var sa_pitch = 146.832384;
var raga = "Bhairavi";
var dataFile = "files/kamakshi_hierarchy.tsv";
var pitchFile = "files/kamakshi_pitch.tsv";
var trackFile = "tracks/Sanjay Subrahmanyan - Kamakshi.mp3";

var volume = undefined;

var head;
var input;
var button;
var menu;

var search_history = [];

var data_raw;
var data = {};
var pitch_raw;
var pitch = {};
var groups = {};

var plot_h = 200;
var plot_w = 1000;
var ver_sep = 20;
var hor_sep = 30;
var text_h = 15;
var box_h = plot_h - 2 * text_h;
var plots_num = 36;

var plot_start;
var plot_end;
var plot_pitch = [];

var plots_index = 0;
var plots_list = [];

var pitch_max;
var pitch_min;

var raga_grid = [];
var svara_list = [];
var plot_grid = [];
var plot_svaras = [];
var time_grid = [];
var svaras = {"R1": 100, "R2": 200, "R3": 300, "G1": 200, "G2": 300, "G3": 400, "M1": 500, "M2": 600, "P": 700, "D1": 800, "D2": 900, "D3": 1000, "N1": 900, "N2": 1000, "N3": 1100};

function preload() {
  data_raw = loadTable(dataFile, "tsv", "header", function () {

    // Parsing the raw data
    for (var i = 0; i < data_raw.rows.length; i++) {
      var row = data_raw.rows[i];
      var element = {};
      element["group"] = row.obj.group_number;
      element["start"] = (row.obj.seq_start * secondsFactor).toFixed(2);
      element["end"] = (row.obj.seq_end * secondsFactor).toFixed(2);
      element["parents"] = []
      if (row.obj.parent_seqs.length > 0) {
        var all_parents = JSON.parse(row.obj.parent_seqs);
        for (var j = 0; j < all_parents.length; j++) {
          if (!element["parents"].includes(all_parents[j])) {
            element["parents"].push(all_parents[j])
          }
        }
      }
      element["children"] = []
      if (row.obj.child_sequence_ix.length > 0) {
        var all_children = JSON.parse(row.obj.child_sequence_ix);
        for (var j = 0; j < all_children.length; j++) {
          if (!element["children"].includes(all_children[j])) {
            element["children"].push(all_children[j])
          }
        }
      }
      data[str(row.obj.seq_start)] = element;
      if (row.obj.importance <= importance_threshold) {
        if (Object.keys(groups).includes(str(row.obj.group_number))) {
          groups[str(row.obj.group_number)].push(str(row.obj.seq_start))
        } else {
          groups[str(row.obj.group_number)] = [str(row.obj.seq_start)];
        }
      }
    }

    // Calculate the maximum plots possible
    var total = 0;
    var max_id;
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      var local_total = 0;
      var el = data[keys[i]];
      for (var j = 0; j < el.parents.length; j++) {
        if (keys.includes(str(el.parents[j]))) {
          local_total++;
        }
      }
      for (var j = 0; j < el.children.length; j++) {
        if (keys.includes(str(el.children[j]))) {
          local_total++;
        }
      }
      if (local_total > total) {
        total = local_total;
        max_id = keys[i]
      }
    }
    console.log(total, max_id);
    plots_num = total + 1;
  });

  pitch_raw = loadTable(pitchFile, "tsv", undefined, function () {
    for(var i = 0; i < pitch_raw.rows.length; i++) {
      var time = float(pitch_raw.rows[i].arr[0]).toFixed(2);
      var hz = float(pitch_raw.rows[i].arr[1]);
      pitch[time] = hz;
    }
  });

  track = loadSound(trackFile);

  var ragas = loadJSON('files/raga-svaras.json', function() {
    var raga_svaras = ragas[raga];
    raga_grid.push(c2h(-1200, sa_pitch));
    svara_list.push('S');
    for (var i = 0; i < raga_svaras.length; i++) {
      raga_grid.push(c2h(svaras[raga_svaras[i]]-1200, sa_pitch));
      svara_list.push(raga_svaras[i]);
    }
    raga_grid.push(sa_pitch);
    svara_list.push('S');
    for (var i = 0; i < raga_svaras.length; i++) {
      raga_grid.push(c2h(svaras[raga_svaras[i]], sa_pitch));
      svara_list.push(raga_svaras[i]);
    }
    raga_grid.push(c2h(1200, sa_pitch));
    svara_list.push('S');
    for (var i = 0; i < raga_svaras.length; i++) {
      raga_grid.push(c2h(svaras[raga_svaras[i]]+1200, sa_pitch));
      svara_list.push(raga_svaras[i]);
    }
    raga_grid.push(c2h(2400, sa_pitch));
    svara_list.push('S');
  });
}

function setup () {
  var canvas = createCanvas(plot_w + 2 * hor_sep,  (plot_h + ver_sep) * plots_num);
  var div = select("#sketch-holder");
  canvas.parent("sketch-holder");

  input = select("#input");
  search_history.push(input.value());

  button = select("#button");
  button.mousePressed(function() {
    start();
  })

  head = select("#head");
  head.style('width: ' + width + 'px;');

  menu = createSelect();
  menu.parent("head");
  menu.position(width - input.width, 5);
  menu.style('width: ' + input.width + 'px;');
  menu.style('height: ' + input.height + 'px;');
  menu.option(input.value());
  menu.changed(function() {
    input.value(menu.value());
    start();
  });

  start();
}

function draw () {
  background(255);
  for (var i = 0; i < plots_list.length; i++) {
    plots_list[i].display();
  }
}

function start () {
  // Reset
  var parents = [];
  var children = [];
  plot_pitch = [];
  plots_index = 0;
  plots_list = [];
  pitch_max = undefined;
  pitch_min = undefined;
  plot_grid = [];
  plot_svaras = [];
  time_grid = [];

  // Data for the basic plot
  var target = data[input.value()];
  plot_start = target.start;
  plot_end = target.end;
  console.log(plot_start, plot_end);

  // Search for the max and min time in parents
  for (var i = 0; i < target.parents.length; i++) {
    if (Object.keys(data).includes(str(target.parents[i]))) {
      var parent_start = data[target.parents[i]].start;
      var parent_end = data[target.parents[i]].end;
      if (parent_start < plot_start) {
        plot_start = parent_start;
      }
      if (parent_end > plot_end) {
        plot_end = parent_end;
      }
      parents.push([target.parents[i], parent_start, parent_end, data[target.parents[i]].group]);
    }
  }

  // Search for the max and min time in children
  for (var i = 0; i < target.children.length; i++) {
    if (Object.keys(data).includes(str(target.children[i]))) {
      var child_start = data[target.children[i]].start;
      var child_end = data[target.children[i]].end;
      if (child_start < plot_start) {
        plot_start = child_start;
      }
      if (child_end > plot_end) {
        plot_end = child_end;
      }
      children.push([target.children[i], child_start, child_end, data[target.children[i]].group]);
    }
  }
  console.log(plot_start, plot_end);

  // Time grid
  var second = ceil(plot_start);
  while (second < plot_end) {
    time_grid.push(map(second, plot_start, plot_end, 0, plot_w));
    second++;
  }

  // Search for max and min pitch range for the plot
  for (var i = plot_start * 100; i <= plot_end * 100; i++) {
    var y = pitch[i/100];
    if (pitch_max == undefined) {
      pitch_max = y;
    } else {
      if (pitch_max < y) {
        pitch_max = y;
      }
    }
    if (y > 0) {
      if (pitch_min == undefined) {
        pitch_min = y;
      } else {
        if (pitch_min > y) {
          pitch_min = y;
        }
      }
    }
  }
  for (var i = 0; i < raga_grid.length; i++) {
    if (raga_grid[i] > pitch_min && raga_grid[i] < pitch_max) {
      var line_y = map(raga_grid[i], pitch_min-10, pitch_max+10, box_h, 0);
      plot_grid.push(line_y);
      plot_svaras.push(svara_list[i]);
    }
  }

  // Computing pitch track for the basic plot
  for (var i = plot_start * 100; i <= plot_end * 100; i++) {
    var x = map(i, plot_start*100, plot_end*100, 0, plot_w);
    var y;
    if (pitch[i/100] < pitch_min) {
      y = map(pitch_min-10, pitch_min-10, pitch_max+10, box_h, 0);
    } else {
      y = map(pitch[i/100], pitch_min-10, pitch_max+10, box_h, 0);
    }
    plot_pitch.push([x, y]);
  }

  // Creating basic plots
  // Parent plots
  for (var i = 0; i < parents.length; i++) {
    var plot = new CreatePlot (parents[i][0], parents[i][1], parents[i][2], parents[i][3], plots_index, false);
    plots_index++;
    plots_list.push(plot);
  }

  // Target plot
  var plot = new CreatePlot (input.value(), target.start, target.end, target.group, plots_index, true);
  plots_index++;
  plots_list.push(plot);

  // Children plots
  for (var i = 0; i < children.length; i++) {
    var plot = new CreatePlot (children[i][0], children[i][1], children[i][2], children[i][3], plots_index, false);
    plots_index++;
    plots_list.push(plot);
  }

  if (!search_history.includes(input.value())) {
    search_history.push(input.value());
    menu.option(input.value());
    menu.selected(input.value());
  }

  window.scrollTo(0, 0);
}

function CreatePlot (id, start, end, group, index, isTarget) {
  this.id = id;
  this.y = (plot_h + ver_sep) * index + ver_sep;
  this.boxY = this.y + text_h
  this.segStart = map(start, plot_start, plot_end, hor_sep, hor_sep + plot_w);
  this.segEnd = map(end, plot_start, plot_end, hor_sep, hor_sep + plot_w);
  this.title = "ID: " + id + "   |   " + time(start) + " (" + start + ") - " + time(end) + " (" + end + ")"

  this.display = function () {
    for (var i = 0; i < time_grid.length; i++) {
      strokeWeight(1);
      stroke(200);
      line(hor_sep + time_grid[i], this.boxY, hor_sep + time_grid[i], this.boxY + box_h);
    }

    for (var i = 0; i < plot_grid.length; i++) {
      strokeWeight(1);
      if (plot_svaras[i] == 'S') {
        stroke(255, 0, 0, 150);
      } else {
        stroke(200);
      }
      line(hor_sep, this.boxY + plot_grid[i], hor_sep + plot_w, this.boxY + plot_grid[i]);
      textAlign(RIGHT, CENTER);
      textSize(text_h * 0.8);
      noStroke();
      fill("black");
      text(plot_svaras[i], hor_sep - 3, this.boxY + plot_grid[i]);
      textAlign(LEFT, CENTER);
      text(plot_svaras[i], hor_sep + plot_w + 3, this.boxY + plot_grid[i]);
    }

    textAlign(LEFT, TOP);
    textSize(text_h);
    noStroke();
    fill("black");
    text(this.title, hor_sep, this.y);
    text(time(plot_start) + " (" + plot_start + ")", hor_sep, this.boxY+box_h+3);
    textAlign(RIGHT, TOP);
    text(groups[group] + " (" + groups[group].length + ")", hor_sep + plot_w, this.y);
    text(time(plot_end) + " (" + plot_end + ")", hor_sep + plot_w, this.boxY+box_h+3);

    strokeWeight(1);
    stroke("black");
    noFill();
    beginShape();
    for (var i = 0; i < plot_pitch.length; i++) {
      vertex(plot_pitch[i][0] + hor_sep, plot_pitch[i][1] + this.boxY)
    }
    endShape();

    if (isTarget) {
      fill(135, 206, 235, 50);
    } else {
      fill(200, 50);
    }
    noStroke();
    rect(this.segStart, this.boxY, this.segEnd-this.segStart, box_h);

    stroke("black");
    strokeWeight(3);
    noFill();
    rect(hor_sep, this.boxY, plot_w, box_h);
  }

  this.clicked = function () {
    if (mouseX > hor_sep && mouseX < hor_sep + plot_w &&
        mouseY > window.pageYOffset &&
        mouseY > this.boxY && mouseY < this.boxY + box_h) {
          track.play(undefined, undefined, volume, start, end-start);
        }
  }
}

function mouseClicked() {
  for (var i = 0; i < plots_list.length; i++) {
    plots_list[i].clicked();
  }
}

function keyPressed() {
  if (keyCode == ENTER) {
    start();
  }
}

function time(seconds) {
  var niceTime;
  var sec = (seconds%60).toFixed(2);
  var min = int(seconds/60);
  niceTime = str(min) + ":" + sec.padStart(5, "0");
  return niceTime
}

function c2h (c, h) {
  return h * (2 ** (c / 1200));
}
