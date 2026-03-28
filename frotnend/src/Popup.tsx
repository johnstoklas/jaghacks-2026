export default function Popup() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md text-center">
        
        {/* Title */}
        <h1 className="text-4xl font-bold text-pink-500 mb-8">
          ReelDaddy
        </h1>

        {/* Text Area */}
        <textarea
          placeholder="Describe what you want..."
          className="
            w-full h-40 p-4
            rounded-2xl
            border-2 border-pink-200
            focus:border-pink-500
            focus:ring-2 focus:ring-pink-200
            outline-none
            resize-none
            transition-all
          "
        />

        {/* Button */}
        <button
          className="
            mt-5 w-full py-4
            rounded-2xl
            bg-pink-500 text-white
            text-lg font-semibold
            hover:bg-pink-600
            active:scale-95
            transition-all
          "
        >
          Begin
        </button>

      </div>
    </div>
  );
}