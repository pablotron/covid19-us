window.addEventListener('DOMContentLoaded', function() {
  "use strict";

  var DATA = null,
      DATA_URL = 'data.json?' + (function () {
        return (new Date()).toISOString().replace(/(T..).+$/, '$1');
      })();

  // cache elements
  var E = ['map', 'none', 'map-bg', 'states', 'y-axis', 'data', 'confirmed', 'deaths', 'count', 'table-units'].reduce(function(r, id) {
    r[id.replace(/-/g, '_')] = document.getElementById(id);
    return r;
  }, {});

  // get today's date as an iso8601 (YYYY-MM-DD) string
  function get_today() {
    return (new Date()).toISOString().replace(/T.+$/, '');
  }

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

    function get_data(id) {
      return DATA.states.data[DATA.states.index[id]];
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

      get_data: function(id) {
        return get_data(id);
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
          return 1.0 * get_data(id).population;
        case 'area_land':
          return 1.0 * get_data(id).area_land_sq_mi;
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

      var TEXTS = {
        cases:      'Number of Cases',
        deaths:     'Number of Deaths',
        population: 'Capita',
        area_land:  'Square Mile',
      };

      function get_axis_label(view) {
        var den = (view.den !== 'one') ? [TEXTS[view.den]] : [];
        return [TEXTS[view.num]].concat(den).join(' Per ');
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

      // FIXME: hack
      get_col_key: function(num) {
        if (num == 'cases') {
          return 'confirmed';
        } else if (num == 'deaths') {
          return 'deaths';
        } else {
          // log error
          console.error('unknown numerator: ' + num);
        }
      },

      get_axis_label: function(view) {
        return get_axis_label(view);
      },

      get_title: function(view) {
        return get_axis_label(view) + ' by State vs. Time';
      },
    };
  })();

  var TableModel = (function() {
    // internal event listeners
    var ehs = {};

    // view state
    var view = { num: 'cases', den: 'one' };


    function fire(ev, args) {
      (ehs[ev] || []).forEach(function(fn) {
        fn.apply(null, args || []);
      });
    }

      var TEXTS = {
        cases:      'Number of Cases',
        deaths:     'Number of Deaths',
        population: 'Capita',
        area_land:  'Square Mile',
      };

      function get_axis_label(view) {
        var den = (view.den !== 'one') ? [TEXTS[view.den]] : [];
        return [TEXTS[view.num]].concat(den).join(' Per ');
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

      // FIXME: hack
      get_col_key: function(num) {
        if (num == 'cases') {
          return 'confirmed';
        } else if (num == 'deaths') {
          return 'deaths';
        } else {
          // log error
          console.error('unknown numerator: ' + num);
        }
      },

      get_axis_label: function(view) {
        return get_axis_label(view);
      },

      get_title: function(view) {
        return get_axis_label(view) + ' by State vs. Time';
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
            '<caption>' + States.get_data(id).name + '</caption>' +

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
        // original palette
        '#4dc9f6',
        '#f67019',
        '#f53794',
        '#537bc4',
        '#acc236',
        '#166a8f',
        '#00a950',
        '#58595b',
        '#8549ba',

        // src: https://learnui.design/tools/data-color-picker.html#palette
        // (note: probably shouldn't be mixing palettes here...)
        '#003f5c',
        '#2f4b7c',
        '#665191',
        '#a05195',
        '#d45087',
        '#f95d6a',
        '#ff7c43',
        '#ffa600',
      ];

      // hash string to u32.
      // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
      function hash(s) {
        // seed, and also hash string twice to increase diffusion
        var r = 77245, l = s.length;
        for (var i = 0; i < 2 * l; i++) {
          var c = s.charCodeAt(i % l);
          r  = ((hash << 5) - r) + c;
          r |= 0;
        }

        // mask to positive
        return r & 0x7FFFFFFF;
      }

      return {
        get: function(id) {
          var name = States.get_data(id).name,
              ofs = hash(name) % COLORS.length;

          console.log({ id: id, name: name, ofs: ofs, color: COLORS[ofs] });

          return COLORS[ofs];
        },
      };
    })(),

    charts: (function() {
      var CHARTS = {}, COLS = [{
        id:   'confirmed',
        name: 'Confirmed Cases',
      }];

      // set axis label and char title
      function set_text(options, view) {
        var label = ChartModel.get_axis_label(view),
            title = ChartModel.get_title(view);

        // set axis label and chart title
        options.scales.yAxes[0].scaleLabel.labelString = label;
        options.title.text = title;
      }

      function refresh() {
        var ids = States.get_active(),
              view = ChartModel.get_view();

        var col_key = ChartModel.get_col_key(view.num);

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
              label: States.get_data(id).name,

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
        init: function(menu_el, none_el, count_el) {
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

          function refresh() {
            setTimeout(function() {
              var data = menu_el.options[menu_el.selectedIndex].dataset,
                  count = count_el.value;

              States.set_filter(data.num, data.den, data.sort, count);
            }, 10);
          }

          // bind to change event
          on(menu_el, {
            change: function() {
              refresh();
            },
          });

          // bind to change event
          on(count_el, {
            change: function() {
              refresh();
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

    table_units: (function() {
      var ITEMS = [{
        name: 'Totals',

        kids: [{
          name: 'Total Number of Cases',
          text: 'Show total number of cases.',

          num:  'cases',
          den:  'one',

          selected: true,
        }, {
          name: 'Total Number of Deaths',
          text: 'Show total number of deaths.',

          num:  'deaths',
          den:  'one',
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

                TableModel.set_view({
                  num: data.num,
                  den: data.den,
                });
              }, 10);
            },
          });
        },
      };
    })(),

    table: (function() {
      var wrap_el = null;

      var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
      function format_date(s) {
        return (s || '').replace(DATE_RE, '$2/$3').replace(/^0*/, '');
      }

      function format_number(view, v) {
        return v;
      }

      function format_population(v) {
        if (v > 1000000) {
          return '' + (v / 1000000.0).toFixed(1) + 'M';
        } else if (v > 1000) {
          return '' + (v / 1000.0).toFixed(1) + 'k';
        }
      }

      function get_csv_name(view) {
       var title = TableModel.get_title(view);
       return 'COVID-19 US - ' + title + ' (' + get_today() + ').csv';
      }

      function make_link(ids) {
        var view = TableModel.get_view(),
            col_key = TableModel.get_col_key(view.num);

        var dates = DATA.data[ids.reduce(function(r, id) {
          var v = DATA.data[id].length;
          return (!r || (v > DATA.data[r].length)) ? id : r;
        })].map(function(row) {
          return row.date;
        });

        var csv_data = [
          ['State', '', 'Population'].concat(dates.map(function(date) {
            return '"' + date + '"';
          })).join(','),
        ].concat(ids.map(function(id) {
          // get state data and denominator for state
          var state = States.get_data(id);
          var den = States.get_denominator_value(view.den, id);

          return [
            '"' + state.name + '"',
            id,
            state.population,
          ].concat(DATA.data[id].map(function(row) {
            return format_number(view, row[col_key] / den);
          })).join(',');
        })).join('\n') + '\n';

        return '<p>' +
          '<a ' +
            'class="csv" ' +
            'download="' + get_csv_name(view) + '"' +
            'title="Download results as a CSV file." ' +
            'href="data:text/csv;charset=utf-8,' + encodeURI(csv_data) + '" ' +
          '>' +
            'Download Results' +
          '</a>' +
        '</p>';
      }

      function get_dates(ids) {
        return DATA.data[ids.reduce(function(r, id) {
          var v = DATA.data[id].length;
          return (!r || (v > DATA.data[r].length)) ? id : r;
        })].map(function(row) {
          return row.date;
        });
      }

      function get_thead(view, dates) {
        var label = TableModel.get_axis_label(view);

        return [[{
          name: '&nbsp;',
          text: '',
          css:  '',
          span: 2,
        }, {
          name: label,
          text: label,
          css:  '',
          span: dates.length,
        }], [{
          name: 'State',
          text: 'State name and abbreviation.',
          css:  'state-name',
          span: 1,
        }, {
          name: 'Population',
          text: 'State population.',
          css:  'num state-pop',
          span: 1,
        }].concat(dates.map(function(date) {
          var s = format_date(date);
          return {
            name: s,
            text: label + ', ' + s,
            css:  'num',
            span: 1,
          };
        }))].map(function(ths) {
          return '<tr>' +
            ths.map(function(th) {
              return '<th ' +
                'class="' + th.css + '" ' +
                'title="' + th.text + '" ' +
                'colspan="' + th.span + '" ' +
              '>' +
                th.name +
              '</th>';
            }).join('') +
          '</tr>';
        }).join('');
      }

      function get_tbody(view, dates, ids) {
        var label = TableModel.get_axis_label(view),
            col_key = TableModel.get_col_key(view.num);

        return ids.map(function(id) {
          // get state data and denominator for state
          var state = States.get_data(id),
              den = States.get_denominator_value(view.den, id);

          return '<tr>' +
            [{
              el:   'th',
              name: state.name + ' (' + id + ')',
              text: 'Last Checked: ' + state.checked,
              css:  'state-name',
            }, {
              name: format_population(state.population),
              text: id + ' population: ' + state.population,
              css:  'num state-pop',
            }].concat(DATA.data[id].map(function(row) {
              var val = format_number(view, row[col_key] / den),
                  tip = label + ' in ' + id + ' as of ' + row.date + ': ' + val;

              return {
                name: val,
                text: tip,
                css:  'num',
              };
            })).map(function(col) {
              var el = (col.el || 'td');
              return '<' + el +' ' +
                'class="' + col.css + '" ' +
                'title="' + col.text + '" ' +
              '>' +
                col.name +
              '</' + el + '>';
            }).join('') +
          '</tr>';
        }).join('');
      }

      function make_table(ids) {
        // get view and dates
        var view = TableModel.get_view(),
            dates = get_dates(ids);

        return '<table>' +
          // '<caption>' + title + '</caption>' +
          '<thead>' +
            get_thead(view, dates) +
          '</thead>' +

          '<tbody>' +
            get_tbody(view, dates, ids) +
          '</tbody>' +
        '</table>';
      }

      function draw(ids) {
        return make_table(ids) +
               make_link(ids);
      }

      function refresh() {
        var ids = States.get_active().filter(function(id) {
          return !!DATA.data[id];
        });

        wrap_el.innerHTML = (ids.length > 0) ? draw(ids) : '';
      }

      return {
        init: function(el) {
          // cache wrapper
          wrap_el = el;

          // bind to states model
          States.on('change', function(id, flag) {
            if (flag === 'active') {
              refresh();
            }
          });

          // bind to chart model
          TableModel.on('change', function() {
            refresh();
          });
        },
      };
    })(),
  };

  // init states, bind to change event
  States.init(DATA_URL).on('change', function(id, flag) {
    var flags = States.get_flags(id);
    Views.map.update(id, flags);
  });

  // init chart model, bind to change event
  // FIXME: move this to view init?
  ChartModel.on('change', function(view) {
    Views.charts.refresh();
  });

  // init map events, charts, and button events
  Views.map.init(E.map);
  // Views.bg.init(E.map_bg);
  Views.picker.init(E.states, E.none, E.count);
  Views.charts.init(E.map);
  Views.table.init(E.data);
  Views.yaxis.init(E.y_axis);
  Views.table_units.init(E.table_units);
});
