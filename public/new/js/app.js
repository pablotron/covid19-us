jQuery(function($) {
  "use strict";

  var CONTROL_BAR_HTML = [
    "<div class='btn-toolbar ml-2 mt-1'>",
      "<div class='btn-group btn-group-sm mr-2'>",
        "<button ",
          "data-id='map-home' ",
          "class='btn btn-light' ",
          "title='Center map and reset zoom' ",
        ">",
          "<i class='fa fa-fw fa-home'></i>",
          // " ",
          // "Home",
        "</button>",
      "</div>",

      "<div class='btn-group btn-group-sm mr-2'>",
        "<button ",
          "class='btn btn-light'  ",
          "title='Find region by name.' ",
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

    onRemove: function(map) {
        // Nothing to do here
    },
  });

  L.control.controlbar = function(opts) {
    return new L.Control.ControlBar(opts);
  };

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
    url:  'data/us-states.json',
    show: true,
  }, {
    id:   'counties',
    url:  'data/us-counties-5m.json',
  }].forEach(function(row) {
    fetch(row.url).then(r => r.json()).then(function(data) {
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
              ev.target.setStyle({
                weight: 5,
                strokeColor: '#666',
                dashArray: '',
                fillOpacity: 0.7
              });
            },

            mouseout: function(ev) {
              console.log(ev);
              layer.resetStyle(ev.target);
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

  L.control.controlbar({
    position: 'bottomleft'
  }).addTo(map);

  // show the scale bar on the lower left corner
  L.control.scale().addTo(map);

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

    console.log('id = ' + id);

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

    ul.find('.active').removeClass('active');
    me.addClass('active');
    console.log(me.data());
    btn.find('span').text(me.data('name'));
    $('body').click();

    return false;
  });

  $('#map-find-dialog').on('show.bs.modal', function() {
    var title = $('input[name="map-layer"]:checked').data('name');
    $('#map-find-dialog-title span').text(title);
    $('#map-find-q').val('');
  }).on('shown.bs.modal', function() {
    $('#map-find-q').focus();
  });
});
