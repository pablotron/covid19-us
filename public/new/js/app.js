jQuery(function($) {
  "use strict";

  function normalize(s) {
    return (s
      .toLowerCase() // convert to lower case
      .replace(/^\s+|\s+$/g, '') // strip leading/trailing whitespace
      .replace(/[^a-z0-9]+/g, ' ') // remove non-alphanumeric characters
    );
  }

  var TEMPLATES = Luigi.cache({
    find_list_css: [
      '#map-find-dialog .list-group-wrap[data-id="%{id}"] .list-group'
    ],

    find_row: [
      "<a ",
        "href='#' ",
        "class='list-group-item list-group-item-action' ",
        "title='%{name|h}' ",
        "data-id='%{id|h}' ",
        "data-name='%{name|h}' ",
        "data-q='%{q|h}' ",
      ">",
        "%{name|h}",
      "</a>",
    ],

    info_card_body: [
      "<div class='card-body'>",
        "<h6 class='card-title'>",
          "%{name|h}",
        "</h6>",

        "%{body}",
      "</div>",
    ],

    info_card_row: [
      "<dt>%{key|h}</dt>",
      "<dd>%{val|h} %{unit}</dd>",
    ],

    loc_info_body: [
      "<div class='row'>",
        "<div class='col'>",
          "<table class='table table-hover table-sm'>",
            "<thead>",
              "<tr>",
                "<th>Name</th>",
                "<th>Value</th>",
              "</tr>",
            "</thead>",

            "<tbody>",
              "%{body}",
            "</tbody>",
          "</table>",
        "</div>",
      "</div>",

      "<div class='row'>",
        "<div class='col'>",
          "<dl>",
            "<dt>Notes</dt>",
            "<dd>%{notes|h}</dd>",
          "</dl>",
        "</div>",
      "</div>",
    ],

    loc_info_row: [
      "<tr>",
        "<td title='%{tip|h}' class='bold'>",
          "%{key|h}",
        "</td>",

        "<td title='%{tip|h}'>",
          "%{val|h} %{unit}",
        "</dd>",
      "</tr>",
    ],
  });

  var CONTROL_BAR_HTML = [
    "<div class='btn-toolbar ml-2 mt-1'>",
      "<div class='btn-group btn-group-sm mr-1'>",
        "<button ",
          "data-id='map-home' ",
          "class='btn btn-light border-dark shadow-sm' ",
          "title='Center map and reset zoom' ",
        ">",
          "<i class='fa fa-fw fa-home'></i>",
          // " ",
          // "Home",
        "</button>",
      "</div>",

      "<div class='btn-group btn-group-sm mr-2'>",
        "<button ",
          "class='btn btn-light border-dark shadow-sm'  ",
          "title='Find region by name.' ",
          "data-id='map-find' ",
          "data-toggle='modal' ",
          "data-target='#map-find-dialog' ",
        ">",
          "<i class='fa fa-fw fa-search'></i>",
          // " ",
          // "Find&hellip;",
        "</button>",
      "</div>",

      "<div class='btn-group btn-group-sm mr-2 hidden'>",
        "<button ",
          "data-id='map-reset' ",
          "class='btn btn-light' ",
          "title='Clear selections' ",
        ">",
          "Reset",
        "</button>",
      "</div>",
    "</div>",
  ].join('');

  L.Control.ControlBar = L.Control.extend({
    onAdd: function(map) {
      return $(CONTROL_BAR_HTML)[0];
    },
  });

  L.control.controlbar = function(opts) {
    return new L.Control.ControlBar(opts);
  };

  var INFO_CARD_HTML = [
    "<div class='card shadow p-0'>",
    "</div>",
  ].join('');

  function number_format(v) {
    if (+v > 1000000) {
      return (+v / 1000000.0).toFixed(1) + 'M';
    } else if (v > 1000) {
      return (+v / 1000.0).toFixed(1) + 'k';
    } else {
      return v.toFixed(1);
    }
  }

  var INFO_CARD_PROPS = [{
    src: 'population',
    dst: 'Population',
    format: v => number_format(v),
  }, {
    src: 'density',
    dst: 'Population Density',
    format: v => number_format(v),
    unit: 'people/mi<sup>2</sup>',
  }];

  var INFO_CARD_CURRENT = {
    state: [{
      src: 'positiveIncrease',
      dst: 'New Cases',
    }, {
      src: 'hospitalizedCurrently',
      dst: 'Currently Hospitalized',
    }, {
      src: 'deathIncrease',
      dst: 'New Deaths',
    }],

    county: [{
      src: 'cases',
      dst: 'Cumulative Cases',
    }, {
      src: 'deaths',
      dst: 'Cumulative Deaths',
    }],
  };

  L.Control.InfoCard = L.Control.extend({
    onAdd: function(map) {
      this._div = $(INFO_CARD_HTML)[0];
      this.update();
      return this._div;
    },

    update: function(feature) {
      var me = $(this._div);
      me.toggleClass('hidden', !feature);
      if (feature) {
        me.html(TEMPLATES.run('info_card_body', {
          name: feature.properties.name,
          body: this.make_body(feature.properties),
        }));
      }
    },

    make_body: function(props) {
      var set = (props.type == 'state') ? 'states' : 'counties',
          md = METADATA ? METADATA[set][props.id].current : null;
      console.log(md);

      return '<dl>' + INFO_CARD_PROPS.map(
        p => ({
          key: p.dst,
          val: p.format ? p.format(props[p.src]) : props[p.src],
          unit: p.unit || '',
        })
      ).concat(md ? INFO_CARD_CURRENT[props.type].map(
        p => (md[p.src] ? {
          key: p.dst,
          val: p.format ? p.format(md[p.src]) : md[p.src],
          unit: p.unit || '',
        } : null)
      ) : []).map(
        row => row ? TEMPLATES.run('info_card_row', row) : ''
      ).join('') + '</dl>';
    },
  });

  L.control.infocard = function(opts) {
    return new L.Control.InfoCard(opts);
  };

  var Active = (function() {
    var list = [];

    function add(id) {
      list = list.filter(cmp_id => (cmp_id !== id)).concat([id]);
      return this;
    }

    function rm(id) {
      list = list.filter(cmp_id => (cmp_id !== id));
    }

    function has(id) {
      return list.indexOf(id) !== -1;
    }

    function toggle(id) {
      var is_active = has(id);

      if (is_active) {
        rm(id);
      } else {
        add(id);
      }

      return !is_active;
    }

    function set(ids) {
      list = [].concat(ids);
    }

    return {
      add: add,
      rm: rm,
      has: has,
      toggle: toggle,
      set: set,
      log: function() {
        console.log(list);
      },
    };
  })();

  // initialize Leaflet
  var map = L.map('map').setView([37.8, -96], 4);

  // add the OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: "&copy; <a href='https://openstreetmap.org/copyright'>OpenStreetMap contributors</a>"
  }).addTo(map);

  // load geojson data and create layers
  var geojson = { data: {}, layers: {} };
  [{
    id:   'states',
    // url:  'data/us-states.json',
    url:  'data/states-20m.json',
    show: true,

    normalize: function(feature) {
      var name = feature.properties.name;
      return {
        id: feature.id,
        name: name,
        q: normalize(name),
      };
    },
  }, {
    id:   'counties',
    // url:  'data/us-counties-5m.json',
    url:  'data/counties-5m.json',

    normalize: function(feature) {
      var name = feature.properties.name;
      return {
        id:   feature.properties.id,
        name: name,
        q:    normalize(name),
      };
    },
  }].forEach(function(row) {
    fetch(row.url).then(r => r.json()).then(function(data) {
      // populate find list
      $(TEMPLATES.run('find_list_css', row)).html(data.features.map(
        f => TEMPLATES.run('find_row', row.normalize(f))
      ).join(''));

      // build map layer
      var layer = L.geoJson(data, {
        style: function(feature) {
          return {
            weight: 2,
            opacity: 1,
            strokeColor: 'white',
            dashArray: '3',
            fillOpacity: 0.3,
            // fillColor: '#0af',
            // fillColor: getColor(feature.properties.density)
          };
        },

        onEachFeature: function(feature, l) {
          l.on({
            mouseover: function(ev) {
              info.update(ev.target.feature);
              ev.target.setStyle({
                weight: 5,
                strokeColor: '#38f',
                dashArray: '',
                fillOpacity: 0.7
              });
            },

            mouseout: function(ev) {
              info.update();
              // console.log(ev);
              layer.resetStyle(ev.target);
              if (Active.has(ev.target.feature.id)) {
                ev.target.setStyle({
                  stroke: true,
                  color: '#666',
                  fill: true,
                });
              }
            },

            click: function(ev) {
              var id = ev.target.feature.id,
                  is_active = Active.toggle(id);

              ev.target.setStyle({
                stroke: true,
                color: is_active ? '#000' : '#38f',
                fillColor: '#3388ff',
              });

              Active.log();
            },

            contextmenu: function(ev) {
              $('#loc-info-dialog').data({
                properties: ev.target.feature.properties,
              }).modal('show');
            },
          });
        },
      });

      geojson.data[row.id] = data;
      geojson.layers[row.id] = layer;

      return layer;
    }).then(function(layer) {
      if (row.show) {
        layer.addTo(map);
      }
    }).then(function() {
      var css = 'input[name="map-layer"][value="' + row.id + '"]';
      $(css).trigger('layer-loaded');
    });
  });

  var info = L.control.infocard({
    position: 'topright'
  }).addTo(map);

  L.control.controlbar({
    position: 'bottomleft'
  }).addTo(map);

  // show the scale bar on the lower left corner
  L.control.scale().addTo(map);

  // load metadata
  var METADATA = null;
  fetch('data/data.json').then(r => r.json()).then(function(data) {
    console.log('metadata loaded');
    METADATA = data;
  });

  $('#map').on('click', 'button[data-id="map-home"]', function() {
    map.setView([37.8, -96], 4);
    $(this).blur();
    return false;
  });

  $('input[name="map-layer"]').on('layer-loaded', function() {
    var me = $(this);
    me.prop('disabled', false);
    me.parent().find('.loading').addClass('hidden');
  }).click(function() {
    var id = $(this).val(),
        layer = geojson.layers[id];

    // remove existing layers
    for (var key in geojson.layers) {
      var tmp = geojson.layers[key];
      if (map.hasLayer(tmp)) {
        map.removeLayer(tmp);
      }
    }

    // add layer
    layer.addTo(map);
  });

  $('.dropdown-menu').on('click', 'a.dropdown-item', function() {
    var me = $(this),
        ul = me.parents('.dropdown-menu'),
        btn = ul.prev('.dropdown-toggle');

    console.log(me.data());

    // set highlight
    ul.find('.active').removeClass('active');
    me.addClass('active');

    // set name
    btn.find('span').text(me.data('name'));

    // hide dropdown
    $('body').click();

    // stop event
    return false;
  });

  $('#map-find-dialog').on('show.bs.modal', function() {
    var view = $('input[name="map-layer"]:checked');

    // reset list
    $(this).find('.list-group-wrap').addClass('hidden');
    $(this).find('.list-group-wrap[data-id="' + view.val() + '"]')
      .removeClass('hidden');

    // set title
    var title = view.data('name');
    $('#map-find-dialog-title span').text(title);

    // clear search field
    $('#map-find-q').val('');
    $(this).find('.list-group-item-action').removeClass('hidden');
  }).on('shown.bs.modal', function() {
    // focus search field
    $('#map-find-q').focus();
  }).on('hide.bs.modal', function() {
    // blur button
    $('#map button[data-id="map-find"]').blur();
  }).find('.list-group').on('click', '.list-group-item-action', function() {
    $(this).toggleClass('active');
    return false;
  });

  (function() {
    var timeout = null;

    $('#map-find-q').keydown(function(ev) {
      var me = $(this);

      if (ev.which != 13) {
        if (timeout) {
          clearTimeout(timeout);
        }

        timeout = setTimeout(function() {
          // normalize query, split into parts
          var qs = normalize(me.val()).split(/[^a-z0-9]/);

          if (qs.length > 0) {
            $.each($('#map-find-dialog .list-group-item-action'), function(i, el) {
              var el_q = $(el).data('q') || '';
              $(el).toggleClass('hidden', ($.grep(qs, function(q) {
                return el_q.indexOf(q) != -1;
              }).length != qs.length));
            });
          } else {
            // no search string, show all values
            $('#map-find-dialog .list-group-item-action').removeClass('hidden');
          }
          timeout = null;
        }, 100);
      }
    });
  })();

  var LOC_INFO_PROPS = [{
    src: 'id',
    dst: 'FIPS Code',
    tip: 'Federal Information Processing Standard identifier',
  }, {
    src: 'population',
    dst: 'Population (2019)',
    tip: 'Estimated 2019 population',
    format: v => number_format(v),
  }, {
    src: 'density',
    dst: 'Population Density (2019)',
    tip: 'Estimated 2019 people per square mile.',
    format: v => number_format(v),
    unit: 'people/mi<sup>2</sup>',
  }, {
    src: 'deaths',
    dst: 'Annual Births (2019)',
    tip: 'Cumulative 2019 births',
  }, {
    src: 'deaths',
    dst: 'Annual Deaths (2019)',
    tip: 'Cumulative 2019 deaths',
  }, {
    src: 'land_area',
    dst: 'Land Area',
    tip: 'Total area in square miles, excluding bodies of water',
    unit: 'mi<sup>2</sup>',
  }];

  var LOC_INFO_CURRENT = {
    state: [{
      src: 'positiveIncrease',
      dst: 'New Cases',
      tip: 'New COVID-19 cases in the last 24 hours'
    }, {
      src: 'deathIncrease',
      dst: 'New Deaths',
      tip: 'Number of COVID-19 deaths in the last 24 hours'
    }, {
      src: 'hospitalizedCurrently',
      dst: 'Hospitalized, Currently',
      tip: 'Current Number of COVID-19 patients hospitalized'
    }, {
      src: 'hospitalizedCumulative',
      dst: 'Hospitalized, Cumulative',
      tip: 'Current Number of COVID-19 patients hospitalized'
    }, {
      src: 'inIcuCurrently',
      dst: 'ICU, Currently',
      tip: 'Current number of COVID-19 patients in Intensive Care Unit (ICU)'
    }, {
      src: 'inIcuCumulative',
      dst: 'ICU, Cumulative',
      tip: 'Cumulative number of COVID-19 patients in Intensive Care Unit (ICU)'
    }, {
      src: 'onVentilatorCurrently',
      dst: 'On Ventilator, Currently',
      tip: 'Current number of COVID-19 patients on ventilators'
    }, {
      src: 'onVentilatorCumulative',
      dst: 'On Ventilator, Cumulative',
      tip: 'Cumulative number of COVID-19 patients on ventilators'
    }],

    county: [{
      src: 'cases',
      dst: 'Cumulative Cases',
      tip: 'Cumulative COVID-19 cases'
    }, {
      src: 'deaths',
      dst: 'Cumulative Deaths',
      tip: 'Cumulative COVID-19 deaths'
    }],
  };

  function get_loc_info_notes(set, id) {
    var md = METADATA ? METADATA[set][id].metadata : null;
    return (md && md.notes) ? md.notes : '';
  }

  function make_loc_info_body(ps) {
    var set = (ps.type == 'state') ? 'states' : 'counties',
        md = METADATA ? METADATA[set][ps.id].current : null;

    return TEMPLATES.run('loc_info_body', {
      body: LOC_INFO_PROPS.map(
        p => ({
          key: p.dst,
          val: p.format ? p.format(ps[p.src]) : ps[p.src],
          tip: p.tip,
          unit: p.unit || '',
        })
      ).concat(md ? LOC_INFO_CURRENT[ps.type].map(
        p => (md[p.src] ? {
          key: p.dst,
          val: p.format ? p.format(md[p.src]) : md[p.src],
          tip: p.tip,
          unit: p.unit || '',
        } : null)
      ) : []).map(
        row => row ? TEMPLATES.run('loc_info_row', row) : ''
      ).join(''),

      notes: get_loc_info_notes(set, ps.id),
    });

    "<div class='row'>" +
      make_loc_info_notes(set, ps.id) +
    "</div>";
  }

  $('#loc-info-dialog').on('show.bs.modal', function() {
    var me = $(this),
        ps = me.data('properties');

    me.find('.modal-title span').text(ps.name);
    me.find('.modal-body').html(make_loc_info_body(ps));
  });
});
