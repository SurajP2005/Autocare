
function validateOdometerRecords({
    vehicle,
    services,
    fuels
}) {
    const issues = [];

    const records = [
        ...services.map(record => ({
            type: "Service",
            date: new Date(record.date),
            odometer: Number(record.odometer),
            id: record._id
        })),

        ...fuels.map(record => ({
            type: "Fuel",
            date: new Date(record.date),
            odometer: Number(record.odometer),
            id: record._id
        }))
    ];

    // Sort all records chronologically.
    records.sort((a, b) => a.date - b.date);

    // Check readings against the vehicle profile.
    for (const record of records) {
        if (record.odometer > Number(vehicle.currentOdometer)) {
            issues.push({
                type: record.type,
                date: record.date,
                odometer: record.odometer,
                message:
                    `${record.type} record shows ${record.odometer} km, ` +
                    `which exceeds the vehicle profile reading of ` +
                    `${vehicle.currentOdometer} km.`
            });
        }
    }

    // Check for decreasing readings over time.
    for (let i = 1; i < records.length; i++) {
        const previous = records[i - 1];
        const current = records[i];

        if (current.odometer < previous.odometer) {
            issues.push({
                type: current.type,
                date: current.date,
                odometer: current.odometer,
                message:
                    `${current.type} record shows ${current.odometer} km, ` +
                    `lower than the previous recorded reading of ` +
                    `${previous.odometer} km (${previous.type}).`
            });
        }
    }

    return issues;
}

module.exports = validateOdometerRecords;
