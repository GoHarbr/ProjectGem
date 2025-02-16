import React, { useState, useCallback } from 'react';
import { Upload, Loader2, Download } from 'lucide-react';
import OpenAI from 'openai';

type CSVData = string[][];

function App() {
  const [file1Data, setFile1Data] = useState<CSVData>([]);
  const [file2Data, setFile2Data] = useState<CSVData>([]);
  const [headers1, setHeaders1] = useState<string[]>([]);
  const [headers2, setHeaders2] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState('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');
  const [error, setError] = useState('');
  const [processedResult, setProcessedResult] = useState<string | null>(null);
  const [processedHeaders, setProcessedHeaders] = useState<string[]>([]);
  const [processedData, setProcessedData] = useState<CSVData>([]);

  const processCSV = (csvText: string): [string[], string[][]] => {
    const lines = csvText.split('\n').map(line => 
      line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    );

    // Remove leading blank columns
    const removeLeadingBlankColumns = (data: string[][]): string[][] => {
      if (data.length === 0) return data;

      // Find the index of the first non-blank column
      let firstNonBlankColIndex = 0;
      while (firstNonBlankColIndex < data[0].length) {
        if (data.some(row => row[firstNonBlankColIndex] !== '')) {
          break;
        }
        firstNonBlankColIndex++;
      }

      // Slice the data to remove leading blank columns
      return data.map(row => row.slice(firstNonBlankColIndex));
    };

    const headers = lines[0];
    const data = lines.slice(1).filter(line => line.some(cell => cell));

    const cleanedData = removeLeadingBlankColumns([headers, ...data]);
    const cleanedHeaders = cleanedData[0];
    const cleanedRows = cleanedData.slice(1);

    return [cleanedHeaders, cleanedRows];
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, fileNumber: 1 | 2) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const [headers, data] = processCSV(text);
      
      if (fileNumber === 1) {
        setHeaders1(headers);
        setFile1Data(data);
      } else {
        setHeaders2(headers);
        setFile2Data(data);
      }
    };
    reader.readAsText(file);
  }, []);

  const processWithOpenAI = async () => {
    if (!apiKey) {
      setError('Please enter your OpenAI API key first');
      return;
    }

    if (!file1Data.length || !file2Data.length) {
      setError('Please upload both CSV files first');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setProcessedResult(null);

      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      // Convert data to CSV format
      const csv1 = [headers1, ...file1Data]
        .map(row => row.join(','))
        .join('\n');
      
      const csv2 = [headers2, ...file2Data]
        .map(row => row.join(','))
        .join('\n');

      const response = await openai.chat.completions.create({
        //model: "o1-mini",
        model: "o3-mini",
        messages: [
          {
            role: "user",
            content: `I want to compare these two spreadsheets side-by-side. 
First collapse each spreadsheet into one column.
Double-check that each spreadsheet is one column only.
Now start matching rows.
If a row exists in one spreadsheet but not the other, use an empty cell to keep alignment. 
Double-check each row carefully. 
Show the result as a CSV. 
Do not provide any commentary.

First spreadsheet:
${csv1}

Second spreadsheet:
${csv2}`
          }
        ]
      });

      let result = response.choices[0].message.content;
      if (result) {
        result = result.replace(/^```csv\s*|\s*```$/g, '');
        setProcessedResult(result);
        const [newHeaders, newData] = processCSV(result);
        setProcessedHeaders(newHeaders);
        setProcessedData(newData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing the files');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedResult) return;

    const blob = new Blob([processedResult], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'processed-comparison.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const maxRows = Math.max(file1Data.length, file2Data.length);
  const maxCols1 = headers1.length;
  const maxCols2 = headers2.length;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">CSV Comparison Tool</h1>

        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        <div className="flex gap-4 mb-8">
          <div className="flex-1">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              First CSV File
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 1)}
                  disabled={isProcessing}
                />
              </label>
            </div>
          </div>
          
          <div className="flex-1">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Second CSV File
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 2)}
                  disabled={isProcessing}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mb-8 flex gap-4">
          <button
            onClick={processWithOpenAI}
            disabled={isProcessing || !file1Data.length || !file2Data.length || !apiKey}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </span>
            ) : (
              'Process formatter'
            )}
          </button>

          {processedResult && !isProcessing && (
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </button>
          )}
        </div>

        {isProcessing && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Processing...</span>
          </div>
        )}

        {processedResult && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex border-b">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${processedHeaders.length}, minmax(100px, 1fr))` }}>
                {processedHeaders.map((header, index) => (
                  <div key={index} className="p-2 font-semibold bg-gray-50 border-r">
                    {header}
                  </div>
                ))}
              </div>
            </div>

            <div className="divide-y">
              {processedData.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${processedHeaders.length}, minmax(100px, 1fr))` }}
                >
                  {row.map((cell, colIndex) => (
                    <div key={colIndex} className="p-2 border-r truncate">
                      {cell}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {processedResult && (
          <div className="">
            <span><br /></span>
          </div>
        )}

        {(file1Data.length > 0 || file2Data.length > 0) && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex border-b">
              {/* Headers */}
              <div className="flex-1 border-r">
                <div className="grid" style={{ gridTemplateColumns: `repeat(${maxCols1}, minmax(100px, 1fr))` }}>
                  {headers1.map((header, index) => (
                    <div key={index} className="p-2 font-semibold bg-gray-50 border-r">
                      {header}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <div className="grid" style={{ gridTemplateColumns: `repeat(${maxCols2}, minmax(100px, 1fr))` }}>
                  {headers2.map((header, index) => (
                    <div key={index} className="p-2 font-semibold bg-gray-50 border-r">
                      {header}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Data Rows */}
            <div className="flex">
              <div className="flex-1 border-r">
                <div className="divide-y">
                  {Array.from({ length: maxRows }).map((_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="grid"
                      style={{ gridTemplateColumns: `repeat(${maxCols1}, minmax(100px, 1fr))` }}
                    >
                      {Array.from({ length: maxCols1 }).map((_, colIndex) => (
                        <div key={colIndex} className="p-2 border-r truncate">
                          {file1Data[rowIndex]?.[colIndex] || ''}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <div className="divide-y">
                  {Array.from({ length: maxRows }).map((_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="grid"
                      style={{ gridTemplateColumns: `repeat(${maxCols2}, minmax(100px, 1fr))` }}
                    >
                      {Array.from({ length: maxCols2 }).map((_, colIndex) => (
                        <div key={colIndex} className="p-2 border-r truncate">
                          {file2Data[rowIndex]?.[colIndex] || ''}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;