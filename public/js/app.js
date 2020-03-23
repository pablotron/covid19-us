window.addEventListener('DOMContentLoaded', function() {
  "use strict";

  var DATA = null,
      DATA_URL = 'data.json?' + (function () {
        return (new Date()).toISOString().replace(/(T..).+$/, '$1');
      })();

  // cache elements
  var E = ['map', 'none', 'map-bg', 'states', 'y-axis', 'data', 'confirmed', 'deaths'].reduce(function(r, id) {
    r[id.replace(/-/g, '_')] = document.getElementById(id);
    return r;
  }, {});

  // bind dom event handlers
  function on(el, evs) {
    for (var ev in evs) {
      el.addEventListener(ev, evs[ev], false);
    }
  }

  var States = (function() {
    var FLAGS = {};

    // internal event listeners
    var ehs = {};

    function fire(ev, args) {
      (ehs[ev] || []).forEach(function(fn) {
        fn.apply(null, args || []);
      });
    }

    function get_ids(num, den, sort, num_rows) {
      var sort_id = [num, den].join('_'),
          rows = (num !== 'none') ? DATA.sorts[sort_id] : [],
          ofs = (sort === 'lo') ? 0 : (rows.length - num_rows),
          r = (sort === 'lo') ? rows.slice(0, num_rows) : rows.slice(ofs);

      console.log({
        num: num,
        den, den,
        sort: sort,
        sort_id: sort_id,
        num_rows: num_rows,
        rows: rows,
        ids: r,
      });

      return r;
    }

    return {
      init: function(url) {
        // fetch data.json
        fetch(url).then(function(r) {
          // parse json
          return r.json();
        }).then(function(r) {
          // cache data
          DATA = r;
        });

        return this;
      },

      get_name: function(id) {
        return DATA.states.data[DATA.states.index[id]].name;
      },

      on: function(ev, fn) {
        if (ehs[ev]) {
          ehs[ev].push(fn);
        } else {
          ehs[ev] = [fn];
        }

        return this;
      },

      get_flags: function(id) {
        return FLAGS[id] || [];
      },

      add_flag: function(id, flag) {
        var flags = FLAGS[id] || [];

        FLAGS[id] = ((flags.length > 0) ? flags.filter(function(v) {
          return (v != flag);
        }) : []).concat([flag]);

        fire('change', [id, flag]);
      },

      rm_flag: function(id, flag) {
        var flags = FLAGS[id] || [];

        FLAGS[id] = (flags.length > 0) ? flags.filter(function(v) {
          return (v != flag);
        }) : [flag];

        fire('change', [id, flag]);
      },

      toggle_flag: function(id, flag) {
        var flags = FLAGS[id] || [],
            has = ((flags.length > 0) && (flags.indexOf(flag) !== -1));

        FLAGS[id] = has ? flags.filter(function(v) {
          return (v != flag);
        }) : (flags || []).concat([flag]);

        fire('change', [id, flag]);
      },

      get_active: function() {
        var r = [];

        for (var id in FLAGS) {
          if (FLAGS[id].indexOf('active') !== -1) {
            r.push(id);
          }
        }

        r.sort();

        return r;
      },

      /**
       * Find matching states by flags.
       *
       * Accepts an array of flags IDs and returns a map of flag ID to
       * array of matching state IDs.
       */
      find_by_flags: function(flags) {
        var r = {};

        for (var id in FLAGS) {
          FLAGS[id].filter(function(flag) {
            return flags.indexOf(flag) !== -1;
          }).forEach(function(flag) {
            r[flag] = r[flag] || [];
            r[flag].push(id);
          });
        }

        // return result
        return r;
      },

      set_filter: function(num, den, sort, num_rows) {
        // clear all active states
        States.get_active().forEach(function(id) {
          States.rm_flag(id, 'active');
        });

        // get by filter
        get_ids(num, den, sort, num_rows).forEach(function(id) {
          States.add_flag(id, 'active');
        });
      },

      get_inactive: function() {
        return DATA.states.data.map(function(row) {
          return row.state;
        }).filter(function(id) {
          return (!FLAGS[id] || (FLAGS[id].indexOf('active') === -1));
        });
      },

      /**
       * Get denominator value for state.
       */
      get_denominator_value: function(type, id) {
        switch (type) {
        case 'population':
          var ofs = DATA.states.index[id];
          return 1.0 * DATA.states.data[ofs].population;
        case 'area_land':
          var ofs = DATA.states.index[id];
          return 1.0 * DATA.states.data[ofs].area_land_sq_mi;
        case 'one':
          return 1;
        default:
          console.error('unknown denominator: ' + type);
        }
      }
    };
  })();

  var ChartModel = (function() {
    // internal event listeners
    var ehs = {};

    // view state
    var view = { num: 'cases', den: 'one' };


    function fire(ev, args) {
      (ehs[ev] || []).forEach(function(fn) {
        fn.apply(null, args || []);
      });
    }

    return {
      on: function(ev, fn) {
        if (ehs[ev]) {
          ehs[ev].push(fn);
        } else {
          ehs[ev] = [fn];
        }

        return this;
      },

      set_view: function(data) {
        view = data;
        console.log(view);
        fire('change', view);
      },

      get_view: function() {
        // return current view
        return view;
      },
    };
  })();

  var Views = {
    map: (function() {
      // svg contentDocument cache
      var doc = null;

      // map event handlers
      var EHS = {
        mouseover: function(ev) {
          States.add_flag(ev.target.id, 'hover');
        },

        mouseout: function(ev) {
          States.rm_flag(ev.target.id, 'hover');
        },

        click: function(ev) {
          States.toggle_flag(ev.target.id, 'active');
        },
      };

      var FLAGS = ['active', 'hover'];

      return {
        init: function(map) {
          // wait for svg to load
          on(map, {
            load: function() {
              // cache svg doc element
              doc = map.contentDocument;

              // bind to map event handlers
              on(doc, EHS);
            },
          });
        },

        update: function(id, flags) {
          // check to make sure svg is loaded and ID is state
          if (!doc || !id.match(/^[A-Z][A-Z]$/)) {
            return;
          }

          // get state element, check for error
          var el = doc.getElementById(id);
          if (!el) {
            return;
          }

          // clear all classes, then add current ones
          var cl = el.classList;
          cl.remove.apply(cl, FLAGS);
          cl.add.apply(cl, flags);
        },
      };
    })(),

    bg: (function() {
      // select event handlers
      var EHS = {
        change: function(ev) {
          var me = ev.target;

          setTimeout(function() {
            set_map_fill(me.value);
          }, 10);
        },
      };

      // FIXME: should be dynamic (pull from DATA.num_buckets)
      var FLAGS = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'];

      function set_map_fill(fill_id) {
        // get existing flags
        var lut = States.find_by_flags(FLAGS);

        // remove existing flags
        for (var flag in lut) {
          lut[flag].forEach(function(id) {
            States.rm_flag(id, flag);
          });
        }

        // add bins for new flags
        (DATA.hists[fill_id] || []).forEach(function(row, i) {
          var flag = 'h' + i;
          row.ids.forEach(function(id) {
            States.add_flag(id, flag);
          });
        });
      }

      return {
        init: function(el) {
          on(el, EHS);
        },
      };
    })(),

    stats_table: (function() {
      var COLS = [{
        src: 'date',
        dst: 'Date',
        css: 'date',
      }, {
        src: 'confirmed',
        dst: 'Confirmed',
        css: 'num',
      }, {
        src: 'deaths',
        dst: 'Deaths',
        css: 'num',
      // }, {
      //   src: 'recovered',
      //   dst: 'Recovered',
      //   css: 'num',
      }];

      return {
        make: function(id) {
          // make sure data is loaded
          if (!DATA || !DATA.data[id]) {
            return '';
          }

          // get state data
          return ('<table>' +
            '<caption>' + States.get_name(id) + '</caption>' +

            '<thead>' +
              '<tr>' + COLS.map(function(col) {
                return '<th>' + col.dst + '</th>';
              }).join('') + '</tr>' +
            '</thead>' +

            '<tbody>' +
              DATA.data[id].map(function(row) {
                return '<tr>' + COLS.map(function(col) {
                  var val = row[col.src];
                  return '<td class="' + col.css + '">' + val + '</td>';
                }).join('') + '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>');
        },
      };
    })(),

    color: (function() {
      var COLORS = [
        '#4dc9f6',
        '#f67019',
        '#f53794',
        '#537bc4',
        '#acc236',
        '#166a8f',
        '#00a950',
        '#58595b',
        '#8549ba',
      ];

      // hash string to u32.
      // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
      function hash(s) {
        var r = 77245, l = s.length;
        for (var i = 0; i < l; i++) {
          var c = s.charCodeAt(i);
          r  = ((hash << 5) - r) + c;
          r |= 0;
        }
        return r;
      }

      return {
        get: function(id) {
          return COLORS[hash(States.get_name(id)) % COLORS.length];
        },
      };
    })(),

    charts: (function() {
      var CHARTS = {}, COLS = [{
        id:   'confirmed',
        name: 'Confirmed Cases',
/*
 *       }, {
 *         id:   'deaths',
 *         name: 'Deaths',
 */
      // }, {
      //   id:   'recovered',
      //   name: 'Recovered',
      }];

      function get_col_key(num) {
        if (num == 'cases') {
          return 'confirmed';
        } else if (num == 'deaths') {
          return 'deaths';
        } else {
          // log error
          console.error('unknown numerator: ' + num);
        }
      }

      var TEXTS = {
        cases:      'Number of Cases',
        deaths:     'Number of Deaths',
        population: 'Capita',
        area_land:  'Square Mile',
      };

      function get_axis_text(view) {
        // build label text
        var den = (view.den !== 'one') ? [TEXTS[view.den]] : [];
        return [TEXTS[view.num]].concat(den).join(' Per ');
      }

      // set axis label and char title
      function set_text(options, view) {
        var s = get_axis_text(view);

        // set axis label
        options.scales.yAxes[0].scaleLabel.labelString = s;

        // set chart title
        options.title.text = s + ' by State vs. Time';
      }

      function refresh() {
        var ids = States.get_active(),
              view = ChartModel.get_view();

        // FIXME: hack
        var col_key = get_col_key(view.num);

        COLS.forEach(function(col) {
          var chart = CHARTS[col.id],
              config_data = chart.config.data;

          // show chart
          chart.wrap.classList.remove('hidden');

          // update axis label and title
          set_text(chart.config.options, view);

          // rebuild labels
          config_data.labels = ids.filter(function(id) {
            return !!DATA.data[id];
          }).map(function(id) {
            return DATA.states.data[DATA.states.index[id]];
          });

          // rebuild datasets
          config_data.datasets = ids.filter(function(id) {
            return !!DATA.data[id];
          }).map(function(id) {
            // get denominator for state
            var den = States.get_denominator_value(view.den, id);

            return {
              label: States.get_name(id),

              lineTension: 0,
              borderColor: Views.color.get(id),
              fill: false,

              data: DATA.data[id].map(function(row) {
                return {
                  x: row.date,
                  y: row[col_key] / den,
                };
              }),
            };
          });

          // update chart
          chart.chart.update();
        });
      }

      return {
        init: function() {
          COLS.forEach(function(col) {
            var config = {
              type: 'line',
              data: {
                // labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
                datasets: [],
              },

              options: {
                scales: {
                  xAxes: [{
                    type: 'time',
                    time: {
                      unit: 'day',
                    },

                    scaleLabel: {
                      display: true,
                      labelString: 'Date',
                    },
                  }],

                  yAxes: [{
                    ticks: {
                      beginAtZero: true,
                    },

                    scaleLabel: {
                      display: true,
                      labelString: col.name,
                    },
                  }],
                },

                title: {
                  display: true,
                  position: 'top',
                  text: col.name + ' by State vs. Time',
                },
              },
            };

            // create chart
            var chart = new Chart(E[col.id], config),
                wrap_css = '.chart-wrap[data-set="' + col.id + '"]';

            // cache config and chart
            CHARTS[col.id] = {
              config: config,
              chart: chart,
              wrap: document.querySelector(wrap_css),
            };
          });

          States.on('change', function(id, flag) {
            if (flag === 'active') {
              // refresh charts
              refresh();
            }
          });
        },

        refresh: function() {
          // refresh charts
          refresh();
        },
      };
    })(),

    picker: (function() {
      var ITEMS = [{
        name: 'General',

        kids: [{
          name: 'None',
          text: 'Clear all selections.',

          sort: 'hi',
          num:  'none',
          den:  'one',

          selected: true,
        }],
      }, {
        name: 'Highest Cases',

        kids: [{
          name: 'Highest Total Number of Cases',
          text: 'States with the highest total number of cases.',

          sort: 'hi',
          num:  'cases',
          den:  'one',
        }, {
          name: 'Highest Cases Per Capita',
          text: 'States with the highest number of total cases per capita.',

          sort: 'hi',
          num:  'cases',
          den:  'population',
        }, {
          name: 'Highest Cases Per Square Mile',
          text: 'States with the highest number of cases per square mile of land.',

          sort: 'hi',
          num:  'cases',
          den:  'area_land',
        }],
      }, {
        name: 'Highest Deaths',
        kids: [{
          name: 'Highest Total Number of Deaths',
          text: 'States with the highest absolute number of deaths.',

          sort: 'hi',
          num:  'deaths',
          den:  'one',
        }, {
          name: 'Highest Deaths Per Capita',
          text: 'States with the highest number of deaths per capita.',

          sort: 'hi',
          num:  'deaths',
          den:  'population',
        }, {
          name: 'Highest Deaths Per Square Mile',
          text: 'States with the highest number of deaths per square mile of land.',

          sort: 'hi',
          num:  'deaths',
          den:  'area_land',
        }],
      }, {
        name: 'Highest Population',

        kids: [{
          name: 'Highest Total Population',
          text: 'States with the highest absolute population.',

          sort: 'hi',
          num:  'population',
          den:  'one',
        }, {
          name: 'Highest Population Per Square Mile',
          text: 'States with the highest population per square mile of land.',

          sort: 'hi',
          num:  'population',
          den:  'area_land',
        }],
      }, {
        name: 'Lowest Cases',
        kids: [{
          name: 'Lowest Total Number of Cases',
          text: 'States with the lowest number of cases.',

          sort: 'lo',
          num:  'cases',
          den:  'one',
        }, {
          name: 'Lowest Cases Per Capita',
          text: 'States with the lowest number of cases per capita.',

          sort: 'lo',
          num:  'cases',
          den:  'population',
        }, {
          name: 'Lowest Cases Per Square Mile',
          text: 'States with the lowest number of cases per square mile of land.',

          sort: 'lo',
          num:  'cases',
          den:  'area_land',
        }],
      }, {
        name: 'Lowest Deaths',
        kids: [{
          name: 'Lowest Total Number of Deaths',
          text: 'States with the lowest total number of deaths.',

          sort: 'lo',
          num:  'deaths',
          den:  'one',
        }, {
          name: 'Lowest Deaths Per Capita',
          text: 'States with the lowest number of deaths per capita.',

          sort: 'lo',
          num:  'deaths',
          den:  'population',
        }, {
          name: 'Lowest Deaths Per Square Mile',
          text: 'States with the lowest number of deaths per square mile of land.',

          sort: 'lo',
          num:  'deaths',
          den:  'area_land',
        }],
      }, {
        name: 'Lowest Population',
        kids: [{
          name: 'Lowest Total Population',
          text: 'States with the lowest total population.',

          sort: 'lo',
          num:  'population',
          den:  'one',
        }, {
          name: 'Lowest Population Per Square Mile',
          text: 'States with the lowest population per square mile of land.',

          sort: 'lo',
          num:  'population',
          den:  'area_land',
        }],
      }];

      return {
        init: function(menu_el, none_el) {
          // populate html
          menu_el.innerHTML = ITEMS.map(function(group) {
            return '<optgroup label="' + group.name + '">' +
              group.kids.map(function(row) {
                return '<option ' +
                  'value="' + row.id + '" ' +
                  'title="' + row.text +'" ' +
                  'data-num="' + row.num + '" ' +
                  'data-den="' + row.den + '" ' +
                  'data-sort="' + row.sort + '" ' +
                  (row.selected ? 'selected="selected" ' : '') +
                '>' +
                  row.name +
                '</option>';
              }).join('') +
            '</optgroup>';
          }).join('');

          // bind to change event
          on(menu_el, {
            change: function() {
              setTimeout(function() {
                var data = menu_el.options[menu_el.selectedIndex].dataset;
                States.set_filter(data.num, data.den, data.sort, 5);
              }, 10);
            },
          });

          on(none_el, {
            click: function() {
              // clear states
              States.set_filter('none');
              menu_el.selectedIndex = 0;
              return false;
            },
          });
        },
      };
    })(),

    yaxis: (function() {
      var ITEMS = [{
        name: 'Cases',

        kids: [{
          name: 'Total Number of Cases',
          text: 'Show total number of cases.',

          num:  'cases',
          den:  'one',

          selected: true,
        }, {
          name: 'Cases Per Capita',
          text: 'Show number of cases per capita.',

          num:  'cases',
          den:  'population',
        }, {
          name: 'Cases Per Square Mile',
          text: 'Show number of cases per square mile of land.',

          num:  'cases',
          den:  'area_land',
        }],
      }, {
        name: 'Deaths',
        kids: [{
          name: 'Total Number of Deaths',
          text: 'Show total number of deaths.',

          num:  'deaths',
          den:  'one',
        }, {
          name: 'Deaths Per Capita',
          text: 'Show number of deaths per capita.',

          num:  'deaths',
          den:  'population',
        }, {
          name: 'Deaths Per Square Mile',
          text: 'Show number of deaths per square mile of land.',

          num:  'deaths',
          den:  'area_land',
        }],
      }];

      return {
        init: function(el) {
          // populate html
          el.innerHTML = ITEMS.map(function(group) {
            return '<optgroup label="' + group.name + '">' +
              group.kids.map(function(row) {
                return '<option ' +
                  'value="' + row.id + '" ' +
                  'title="' + row.text +'" ' +
                  'data-num="' + row.num + '" ' +
                  'data-den="' + row.den + '" ' +
                  (row.selected ? 'selected="selected" ' : '') +
                '>' +
                  row.name +
                '</option>';
              }).join('') +
            '</optgroup>';
          }).join('');

          // bind to change event
          on(el, {
            change: function() {
              setTimeout(function() {
                var data = el.options[el.selectedIndex].dataset;

                ChartModel.set_view({
                  num: data.num,
                  den: data.den,
                });
              }, 10);
            },
          });
        },
      };
    })(),
  };

  // init states, bind to change event
  States.init(DATA_URL).on('change', function(id) {
    var flags = States.get_flags(id);
    E.data.innerHTML = (flags.length > 0) ? Views.stats_table.make(id) : '';
    Views.map.update(id, flags);
  });

  // init chart model, bind to change event
  ChartModel.on('change', function(view) {
    Views.charts.refresh();
  });

  // init map events, charts, and button events
  Views.map.init(E.map);
  // Views.bg.init(E.map_bg);
  Views.picker.init(E.states, E.none);
  Views.charts.init(E.map);
  Views.yaxis.init(E.y_axis);
});
