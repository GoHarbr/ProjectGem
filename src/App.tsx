import React, { useState, useCallback } from 'react';
import { Upload, Loader2, Download } from 'lucide-react';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

type CSVData = string[][];
type Provider = 'openai' | 'deepseek' | 'gemini' | 'claude';

interface ModelOption {
  value: string;
  label: string;
}

const modelOptions: Record<Provider, ModelOption[]> = {
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-pro', label: 'Gemini Pro' }
  ],
  openai: [
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o1-mini', label: 'o1 Mini' },
    { value: 'o3-mini', label: 'o3 Mini' }
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'deepseek-coder', label: 'DeepSeek Coder' }
  ],
  claude: [
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-2.1', label: 'Claude 2.1' }
  ]
};

function App() {
  const [file1Data, setFile1Data] = useState<CSVData>([]);
  const [file2Data, setFile2Data] = useState<CSVData>([]);
  const [headers1, setHeaders1] = useState<string[]>([]);
  const [headers2, setHeaders2] = useState<string[]>([]);
  const [processedHeaders, setProcessedHeaders] = useState<string[]>([]);
  const [processedData, setProcessedData] = useState<CSVData>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  //const [apiKey, setApiKey] = useState('');
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  //const [apiKey, setApiKey] = useState(import.meta.env.VITE_OPENAI_API_KEY || '');
  const [error, setError] = useState('');
  const [processedResult, setProcessedResult] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>(modelOptions.gemini[1].value);

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

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as Provider;
    setSelectedProvider(newProvider);
    setSelectedModel(modelOptions[newProvider][0].value);
  };

  const getPrompt = (headers1: string[], data1: string[][], headers2: string[], data2: string[][]) => {
    const formatData = (headers: string[], data: string[][]) => {
      return [headers.join(', '), ...data.map(row => row.join(', '))].join('\n');
    };

    const csv1 = formatData(headers1, data1);
    const csv2 = formatData(headers2, data2);

    return `I want to compare these two spreadsheets side-by-side. 
  First collapse each spreadsheet into one column.
  Make an index from the row and cell data from First spreadsheet.
  Use the index to match rows and cells in Second spreadsheet.
  If there is no matching pair, use an empty cell.
  Double-check each row carefully. 
  Show the result as a **well-formed CSV** with exactly two columns. 
  Do not provide any commentary.

  First spreadsheet:
  ${csv1}

  Second spreadsheet:
  ${csv2}`;
  };

  const processWithAI = async () => {
    if (!apiKey) {
      setError(`Please enter your ${selectedProvider.toUpperCase()} API key first`);
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

      const prompt = getPrompt(headers1, file1Data, headers2, file2Data);
      let result: string;

      switch (selectedProvider) {
        case 'openai': {
          const openai = new OpenAI({ 
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
          });
          const response = await openai.chat.completions.create({
            model: selectedModel,
            messages: [{ role: "user", content: prompt }],
          });
          result = response.choices[0].message.content || '';
          break;
        }
        case 'deepseek': {
          const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [{ role: "user", content: prompt }]
            })
          });
          if (!response.ok) throw new Error(`DeepSeek API error: ${response.statusText}`);
          const data = await response.json();
          result = data.choices[0].message.content;
          break;
        }
        case 'gemini': {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: selectedModel });
          const response = await model.generateContent(prompt);
          result = response.response.text();
          break;
        }
        case 'claude': {
          const anthropic = new Anthropic({ apiKey });
          const response = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt }],
          });
          result = response.content[0].text;
          break;
        }
        default:
          throw new Error('Invalid provider selected');
      }

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
        <img
          src="https://harbr.com/wp-content/uploads/2021/05/Harbr_black-on-light_small.png"
          width="100"
        />
        <br />
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Financials Comparison Tool</h1>

        <div class="hidden">
          <div className="mb-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  AI Provider
                </label>
                <select
                  value={selectedProvider}
                  onChange={handleProviderChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isProcessing}
                >
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="claude">Anthropic Claude</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isProcessing}
                >
                  {modelOptions[selectedProvider].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                {selectedProvider.toUpperCase()} API Key
              </label>
              <input
                type="password"
                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={`Enter your ${selectedProvider.toUpperCase()} API key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>
        </div>

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
            onClick={processWithAI}
            disabled={isProcessing || !file1Data.length || !file2Data.length || !apiKey}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </span>
            ) : (
              //`Process with ${selectedModel}`
              `Process Financials`
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