var target_id = 21186;
var secondsFactor = 0.0029024875016400026;
var importance_threshold = 0.4;
var dataFile = "../files/kamakshi_hierarchy.tsv";
var pitchFile = "../files/kamakshi_pitch.tsv";
var trackName = "Sanjay Subrahmanyan - Kamakshi.mp3";

var data_raw;
var data = {};
var pitch_raw;
var pitch = {};
var groups = {};

var plot_h = 200;
var plot_w = 1000;
var ver_sep = 20;
var hor_sep = 10;
var text_h = 15;
var box_h = plot_h - 2 * text_h;

var target;

var parents = [];
var children = [];
var plot_start;
var plot_end;
var plot_pitch = [];

var plots_index = 0;
var plots_list = [];

var pitch_max;
var pitch_min;

function preload() {
  data_raw = loadTable(dataFile, "tsv", "header", function () {

    // Parsing the raw data
    for (var i = 0; i < data_raw.rows.length; i++) {
      var row = data_raw.rows[i];
      var element = {};
      element["group"] = row.obj.group_number;
      element["start"] = (row.obj.seq_start * secondsFactor).toFixed(2);
      element["end"] = (row.obj.seq_end * secondsFactor).toFixed(2);
      if (row.obj.parent_seqs.length == 0) {
        element["parents"] = [];
      } else {
        element["parents"] = JSON.parse(row.obj.parent_seqs);
      }
      if (row.obj.child_sequence_ix.length == 0) {
        element["children"] = [];
      } else {
        element["children"] = JSON.parse(row.obj.child_sequence_ix);
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

    // Data for the basic plot
    target = data[target_id]
    plot_start = target.start;
    plot_end = target.end;
    console.log(plot_start, plot_end);

    // Search for the minimum time
    for (var i = 0; i < target.parents.length; i++) {
      if (Object.keys(data).includes(str(target.parents[i]))) {
        var value = data[target.parents[i]].start;
        if (value < plot_start) {
          plot_start = value;
        }
        parents.push([target.parents[i], value, data[target.parents[i]].end, data[target.parents[i]].group]);
      }
    }

    // Search for the maximum time
    for (var i = 0; i < target.children.length; i++) {
      if (Object.keys(data).includes(str(target.children[i]))) {
        var value = data[target.children[i]].end;
        if (value > plot_end) {
          plot_end = value;
        }
        children.push([target.children[i], data[target.children[i]].start, value, data[target.children[i]].group]);
      }
    }
    console.log(plot_start, plot_end);
  });

  pitch_raw = loadTable(pitchFile, "tsv", undefined, function () {
    for(var i = 0; i < pitch_raw.rows.length; i++) {
      var time = float(pitch_raw.rows[i].arr[0]).toFixed(2);
      var hz = float(pitch_raw.rows[i].arr[1]);
      pitch[time] = hz;
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
    var plot = new CreatePlot (target_id, target.start, target.end, target.group, plots_index, true);
    plots_index++;
    plots_list.push(plot);

    // Children plots
    for (var i = 0; i < children.length; i++) {
      var plot = new CreatePlot (children[i][0], children[i][1], children[i][2], children[i][3], plots_index, false);
      plots_index++;
      plots_list.push(plot);
    }
  });

  track = loadSound("../tracks/" + trackName);
}

function setup () {
  var plots_num = parents.length + children.length + 1;
  var canvas = createCanvas(plot_w + 2 * hor_sep,  (plot_h + 2 * ver_sep) * (plots_list.length - 1));
  var div = select("#sketch-holder");
  canvas.parent("sketch-holder");
}

function draw () {
  for (var i = 0; plots_list.length; i++) {
    console.log(plots_list[i].id);
    plots_list[i].display();
  }
}

function CreatePlot (id, start, end, group, index, isTarget) {
  this.id = id;
  this.y = (plot_h + ver_sep) * index + ver_sep;
  this.boxY = this.y + text_h
  this.segStart = map(start, plot_start, plot_end, hor_sep, hor_sep + plot_w);
  this.segEnd = map(end, plot_start, plot_end, hor_sep, hor_sep + plot_w);
  this.title = "ID: " + id + "   |   " + time(start) + " (" + start + ") - " + time(end) + " (" + end + ")"

  this.display = function () {
    textAlign(LEFT, TOP);
    textSize(text_h);
    noStroke();
    fill("black");
    text(this.title, hor_sep, this.y);
    text(time(start) + " (" + plot_start + ")", hor_sep, this.boxY+box_h+3);
    textAlign(RIGHT, TOP);
    text(groups[group] + " (" + groups[group].length + ")", hor_sep + plot_w, this.y);
    text(time(end) + " (" + plot_end + ")", hor_sep + plot_w, this.boxY+box_h+3);

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
        mouseY > this.boxY && mouseY < this.boxY + box_h) {
          track.play(undefined, undefined, 15, start, end-start);
        }
  }
}

function mouseClicked() {
  for (var i = 0; i < plots_list.length; i++) {
    plots_list[i].clicked();
  }
}

function time(seconds) {
  var niceTime;
  var sec = (seconds%60).toFixed(2);
  var min = int(seconds/60);
  niceTime = str(min) + ":" + sec.padStart(5, "0");
  return niceTime
}
