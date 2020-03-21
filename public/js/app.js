window.addEventListener('DOMContentLoaded', function() {
  "use strict";

  var DATA = null,
      DATA_URL = 'data.json?' + (function () {
        return (new Date()).toISOString().replace(/(T..).+$/, '$1');
      })();

  // cache elements
  var E = ['map', 'data', 'confirmed', 'deaths'].reduce(function(r, id) {
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

    var FILTERS = {
      cases: function(id) {
        var data = DATA.data[id];
        return data[data.length - 1].confirmed;
      },

      deaths: function(id) {
        var data = DATA.data[id];
        return data[data.length - 1].deaths;
      },

      population: function(id) {
        return DATA.states.data[DATA.states.index[id]].population;
      },

      per_capita: function(id) {
        var pop = DATA.states.data[DATA.states.index[id]].population,
            data = DATA.data[id];
        return Math.round(1000.0 * data[data.length - 1].confirmed / pop);
      },
    };

    function get_ids(filter_id, sort, num) {
      var rows = DATA.sorts[filter_id],
          ofs = (sort === 'asc') ? 0 : (rows.length - 1 - num),
          r = (sort === 'asc') ? rows.slice(0, num) : rows.slice(ofs);
      console.log({
        filter_id: filter_id,
        sort: sort,
        num: num,
        rows: rows,
        filter_id: filter_id,
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

      set_filter: function(filter_id, sort, num) {
        if (filter_id == 'all') {
          // add all inactive states
          States.get_inactive().forEach(function(id) {
            States.add_flag(id, 'active');
          });
        } else if (filter_id == 'none') {
          // clear all active states
          States.get_active().forEach(function(id) {
            States.rm_flag(id, 'active');
          });
        } else {
          // clear all active states
          States.get_active().forEach(function(id) {
            States.rm_flag(id, 'active');
          });

          // get by filter
          get_ids(filter_id, sort, num).forEach(function(id) {
            States.add_flag(id, 'active');
          });
        }
      },

      get_inactive: function() {
        return DATA.states.data.map(function(row) {
          return row.state;
        }).filter(function(id) {
          return (!FLAGS[id] || (FLAGS[id].indexOf('active') === -1));
        });
      },
    };
  })();

  var Views = {
    map: (function() {
      // svg contentDocument cache
      var doc = null;

      // event handlers
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
      }, {
        id:   'deaths',
        name: 'Deaths',
      // }, {
      //   id:   'recovered',
      //   name: 'Recovered',
      }];

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
            var chart = new Chart(E[col.id], config);

            // cache config and chart
            CHARTS[col.id] = {
              config: config,
              chart: chart,
            };
          });

          States.on('change', function(id, flag) {
            var ids = States.get_active(),
                st = DATA.states.data[DATA.states.index[id]];

            if (flag !== 'active') {
              return;
            }

            COLS.forEach(function(col) {
              var chart = CHARTS[col.id],
                  config_data = chart.config.data;

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
                return {
                  label: States.get_name(id),

                  lineTension: 0,
                  borderColor: Views.color.get(id),
                  fill: false,

                  data: DATA.data[id].map(function(row) {
                    return {
                      x: row.date,
                      y: row[col.id],
                    };
                  }),
                };
              });

              // update chart
              chart.chart.update();
            });
          });
        }
      };
    })(),

    masks: (function() {
      var ELS = document.getElementsByClassName('mask'),
          MS = 10, // delay, in ms
          timeout = null,
          active_btn = null;

      function clear() {
        timeout = null;

        for (var i = 0; i < ELS.length; i++) {
          if (ELS[i] !== active_btn) {
            ELS[i].classList.remove('active');
          }
        }

        if (active_btn) {
          // toggle active button
          active_btn.classList.add('active');
        }
      }

      return {
        init: function() {
          States.on('change', function(id, flag) {
            if (flag === 'active') {
              // clear active filter button
              active_btn = null;

              if (timeout !== null) {
                // remove existing timeout
                clearTimeout(timeout);
              }

              // set timeout
              setTimeout(clear, MS);
            }
          });

          for (var i = 0; i < ELS.length; i++) {
            on(ELS[i], {
              click: function(ev) {
                var data = ev.target.dataset;
                States.set_filter(data.id, data.sort, 5);

                if (data.id !== 'none') {
                  active_btn = ev.target;
                }

                // stop event
                return false;
              },
            });
          }
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

  // init map events, charts, and button events
  Views.map.init(E.map);
  Views.charts.init(E.map);
  Views.masks.init();
});
