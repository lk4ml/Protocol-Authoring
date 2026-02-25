# Protocol Authoring Platform

A modern protocol authoring platform built with React, integrating CDISC standards and TransCelerate DDF (Digital Data Flow) initiatives.

## Features

- **CDISC Standards Integration**: Fetches controlled terminology from CDISC Library API
- **USDM v4.0 Support**: Transforms protocol data to Unified Study Definitions Model
- **ODM-XML Export**: Generates CDISC ODM-XML 1.3.2 compliant files
- **SDR Integration**: Connects to TransCelerate Study Definitions Repository
- **Biomedical Concepts**: Maps activities to CDISC Biomedical Concepts
- **Schedule of Activities**: Visual SOA builder with visit/activity assignments

## Project Structure

```
Protocol_Authoring/
├── src/
│   ├── components/          # React components
│   │   ├── modules/        # Module components (Protocol, Design, SOA, etc.)
│   │   ├── modals/         # Modal dialogs
│   │   ├── Sidebar.jsx
│   │   └── Header.jsx
│   ├── services/           # API services
│   │   ├── cdiscLibraryService.js  # CDISC Library API
│   │   ├── sdrService.js            # SDR API
│   │   └── veevaEDCService.js      # Veeva EDC (simulated)
│   ├── hooks/              # Custom React hooks
│   │   └── useCDISCData.js
│   ├── utils/              # Utility functions
│   │   ├── usdmTransformer.js
│   │   ├── odmGenerator.js
│   │   └── uuid.js
│   ├── types/              # Type definitions
│   │   └── usdm.js
│   ├── constants/          # Constants
│   │   └── activityCategories.js
│   ├── App.jsx             # Main application component
│   ├── main.jsx            # Entry point
│   └── index.css           # Styles
├── package.json
├── vite.config.js
└── README.md
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Building

```bash
npm run build
```

## Key Integrations

### CDISC Library API

The platform fetches controlled terminology from the CDISC Library REST API:
- Study Phases
- Study Types
- Intervention Models
- Blinding Schemas
- SDTM Domains
- Biomedical Concepts

**Note**: The CDISC Library API endpoints in the code are examples. You may need to:
1. Obtain API credentials from CDISC
2. Update the API endpoints based on the actual CDISC Library API documentation
3. Configure CORS if needed

### TransCelerate SDR

The platform integrates with the Study Definitions Repository (SDR) for:
- USDM validation
- Study definition storage
- Study definition retrieval

**Note**: By default, the SDR service points to `http://localhost:5000`. Update the base URL in `src/services/sdrService.js` to point to your SDR instance.

### USDM v4.0

The platform generates USDM v4.0 compliant study definitions that can be:
- Exported as JSON
- Validated against USDM schema
- Pushed to SDR
- Transformed to other formats (ODM-XML, etc.)

## Configuration

### CDISC Library API

Update the base URL in `src/services/cdiscLibraryService.js`:

```javascript
this.baseUrl = 'https://api.cdisc.org/api'; // Update with actual API endpoint
```

### SDR Service

Update the base URL in `src/services/sdrService.js`:

```javascript
constructor(baseUrl = 'http://localhost:5000') {
  // Update with your SDR instance URL
}
```

## Dependencies

- **React 18**: UI framework
- **Vite**: Build tool
- **Axios**: HTTP client for API calls
- **xml-js**: XML generation for ODM export
- **Tailwind CSS**: Styling (via CDN or install separately)

## Standards Compliance

- **USDM v4.0**: Unified Study Definitions Model
- **CDISC ODM 1.3.2**: Operational Data Model
- **CDISC SDTM**: Study Data Tabulation Model
- **CDISC CDASH**: Clinical Data Acquisition Standards Harmonization
- **CDISC CT**: Controlled Terminology

## License

MIT

## Contributing

This is a refactored version of a protocol authoring platform. Contributions welcome!

